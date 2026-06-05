import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import { hashPassword, verifyPassword } from "../lib/hash.js";
import { slugify } from "../lib/slug.js";
import { createDashboardToken } from "../lib/token.js";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  locale: string;
  timezone: string;
};

export type TeamSummary = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type AuthSession = {
  user: PublicUser;
  teams: TeamSummary[];
  token: string;
};

export class AuthService {
  constructor(private readonly dataSource: DataSource) {}

  async register(input: { email: string; name: string; password: string; teamName?: string; locale?: string; timezone?: string }): Promise<AuthSession> {
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) throw Object.assign(new Error("Invalid email"), { statusCode: 400 });
    if (input.password.length < 8) throw Object.assign(new Error("Password must be at least 8 characters"), { statusCode: 400 });

    const existing = await this.dataSource.query("select id from users where email = ?", [email]);
    if (existing.length > 0) throw Object.assign(new Error("Email already registered"), { statusCode: 409 });

    const userId = randomUUID();
    const teamId = randomUUID();
    const memberId = randomUUID();
    const teamName = input.teamName?.trim() || `${input.name.trim()}'s Team`;
    const passwordHash = await hashPassword(input.password);
    const slug = `${slugify(teamName)}-${teamId.slice(0, 8)}`;

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        "insert into users (id, email, name, passwordHash, locale, timezone, isActive) values (?, ?, ?, ?, ?, ?, 1)",
        [userId, email, input.name.trim(), passwordHash, input.locale ?? "en", input.timezone ?? "UTC"],
      );
      await manager.query("insert into teams (id, name, slug, ownerId) values (?, ?, ?, ?)", [teamId, teamName, slug, userId]);
      await manager.query("insert into team_members (id, teamId, userId, role, isActive) values (?, ?, ?, 'owner', 1)", [
        memberId,
        teamId,
        userId,
      ]);
    });

    return this.buildSession(userId);
  }

  async login(emailInput: string, password: string): Promise<AuthSession> {
    const email = emailInput.trim().toLowerCase();
    const users = await this.dataSource.query("select * from users where email = ? and isActive = 1", [email]);
    const user = users[0] as { id: string; email: string; passwordHash: string } | undefined;
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw Object.assign(new Error("Invalid credentials"), { statusCode: 401 });
    }
    await this.dataSource.query("update users set lastLoginAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP where id = ?", [user.id]);
    return this.buildSession(user.id);
  }

  async getSessionForUser(userId: string): Promise<Omit<AuthSession, "token">> {
    const session = await this.buildSession(userId);
    return { user: session.user, teams: session.teams };
  }

  async updateMe(userId: string, input: { name?: string; locale?: string; timezone?: string }): Promise<PublicUser> {
    const current = await this.getUserById(userId);
    const name = input.name?.trim() || current.name;
    const locale = input.locale || current.locale;
    const timezone = input.timezone || current.timezone;
    await this.dataSource.query("update users set name = ?, locale = ?, timezone = ?, updatedAt = CURRENT_TIMESTAMP where id = ?", [
      name,
      locale,
      timezone,
      userId,
    ]);
    return this.getUserById(userId);
  }

  async getUserById(userId: string): Promise<PublicUser> {
    const rows = await this.dataSource.query("select id, email, name, locale, timezone from users where id = ? and isActive = 1", [userId]);
    const user = rows[0] as PublicUser | undefined;
    if (!user) throw Object.assign(new Error("User not found"), { statusCode: 401 });
    return user;
  }

  private async buildSession(userId: string): Promise<AuthSession> {
    const user = await this.getUserById(userId);
    const teams = (await this.dataSource.query(
      `select t.id, t.name, t.slug, tm.role
       from teams t
       join team_members tm on tm.teamId = t.id
       where tm.userId = ? and tm.isActive = 1
       order by t.createdAt asc`,
      [userId],
    )) as TeamSummary[];
    return { user, teams, token: createDashboardToken({ sub: user.id, email: user.email }) };
  }
}
