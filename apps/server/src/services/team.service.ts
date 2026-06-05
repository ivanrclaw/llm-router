import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import { slugify } from "../lib/slug.js";

export type TeamRole = "owner" | "admin" | "member" | "viewer";
const ROLE_RANK: Record<TeamRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export class TeamService {
  constructor(private readonly dataSource: DataSource) {}

  async listTeams(userId: string) {
    return this.dataSource.query(
      `select t.id, t.name, t.slug, t.ownerId, tm.role
       from teams t join team_members tm on tm.teamId = t.id
       where tm.userId = ? and tm.isActive = 1
       order by t.createdAt asc`,
      [userId],
    );
  }

  async createTeam(userId: string, input: { name: string }) {
    const id = randomUUID();
    const slug = `${slugify(input.name)}-${id.slice(0, 8)}`;
    await this.dataSource.transaction(async (manager) => {
      await manager.query("insert into teams (id, name, slug, ownerId) values (?, ?, ?, ?)", [id, input.name.trim(), slug, userId]);
      await manager.query("insert into team_members (id, teamId, userId, role, isActive) values (?, ?, ?, 'owner', 1)", [
        randomUUID(),
        id,
        userId,
      ]);
    });
    return this.getTeamForUser(userId, id);
  }

  async getTeamForUser(userId: string, teamId: string) {
    await this.requireRole(userId, teamId, "viewer");
    const rows = await this.dataSource.query("select id, name, slug, ownerId from teams where id = ?", [teamId]);
    return rows[0];
  }

  async updateTeam(userId: string, teamId: string, input: { name?: string }) {
    await this.requireRole(userId, teamId, "admin");
    const current = await this.getTeamForUser(userId, teamId);
    await this.dataSource.query("update teams set name = ?, updatedAt = CURRENT_TIMESTAMP where id = ?", [input.name?.trim() || current.name, teamId]);
    return this.getTeamForUser(userId, teamId);
  }

  async listMembers(userId: string, teamId: string) {
    await this.requireRole(userId, teamId, "viewer");
    return this.dataSource.query(
      `select tm.id, tm.teamId, tm.userId, tm.role, tm.isActive, u.email, u.name
       from team_members tm join users u on u.id = tm.userId
       where tm.teamId = ? and tm.isActive = 1
       order by case tm.role when 'owner' then 1 when 'admin' then 2 when 'member' then 3 else 4 end, u.email asc`,
      [teamId],
    );
  }

  async updateMemberRole(actorUserId: string, teamId: string, memberId: string, role: TeamRole) {
    await this.requireRole(actorUserId, teamId, "admin");
    if (role === "owner") throw Object.assign(new Error("Owner transfer is not supported here"), { statusCode: 400 });
    const rows = await this.dataSource.query("select * from team_members where id = ? and teamId = ? and isActive = 1", [memberId, teamId]);
    const member = rows[0] as { id: string; role: TeamRole; userId: string } | undefined;
    if (!member) throw Object.assign(new Error("Member not found"), { statusCode: 404 });
    if (member.role === "owner") throw Object.assign(new Error("Cannot change owner role"), { statusCode: 403 });
    await this.dataSource.query("update team_members set role = ?, updatedAt = CURRENT_TIMESTAMP where id = ?", [role, memberId]);
    return (await this.dataSource.query("select id, teamId, userId, role, isActive from team_members where id = ?", [memberId]))[0];
  }

  async removeMember(actorUserId: string, teamId: string, memberId: string) {
    await this.requireRole(actorUserId, teamId, "admin");
    const rows = await this.dataSource.query("select * from team_members where id = ? and teamId = ? and isActive = 1", [memberId, teamId]);
    const member = rows[0] as { role: TeamRole } | undefined;
    if (!member) throw Object.assign(new Error("Member not found"), { statusCode: 404 });
    if (member.role === "owner") throw Object.assign(new Error("Cannot remove owner"), { statusCode: 403 });
    await this.dataSource.query("update team_members set isActive = 0, updatedAt = CURRENT_TIMESTAMP where id = ?", [memberId]);
  }

  async requireRole(userId: string, teamId: string, minimumRole: TeamRole): Promise<TeamRole> {
    const rows = await this.dataSource.query("select role from team_members where userId = ? and teamId = ? and isActive = 1", [userId, teamId]);
    const role = rows[0]?.role as TeamRole | undefined;
    if (!role) throw Object.assign(new Error("Team not found"), { statusCode: 404 });
    if (ROLE_RANK[role] < ROLE_RANK[minimumRole]) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    return role;
  }
}
