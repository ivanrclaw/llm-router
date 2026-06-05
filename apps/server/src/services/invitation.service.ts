import { randomBytes, randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import { sha256 } from "../lib/slug.js";
import { TeamService, type TeamRole } from "./team.service.js";

export class InvitationService {
  private readonly teamService: TeamService;

  constructor(private readonly dataSource: DataSource) {
    this.teamService = new TeamService(dataSource);
  }

  async createInvitation(actorUserId: string, teamId: string, input: { email: string; role: Exclude<TeamRole, "owner"> }) {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = sha256(token);
    const id = randomUUID();
    await this.dataSource.query(
      `insert into invitations (id, teamId, email, role, tokenHash, expiresAt, createdByUserId)
       values (?, ?, ?, ?, ?, datetime('now', '+7 days'), ?)`,
      [id, teamId, input.email.trim().toLowerCase(), input.role, tokenHash, actorUserId],
    );
    return { id, teamId, email: input.email.trim().toLowerCase(), role: input.role, expiresAt: null, token };
  }

  async acceptInvitation(userId: string, token: string) {
    const tokenHash = sha256(token);
    const rows = await this.dataSource.query(
      "select * from invitations where tokenHash = ? and acceptedAt is null and expiresAt > CURRENT_TIMESTAMP",
      [tokenHash],
    );
    const invitation = rows[0] as { id: string; teamId: string; email: string; role: TeamRole } | undefined;
    if (!invitation) throw Object.assign(new Error("Invitation not found or expired"), { statusCode: 404 });
    const users = await this.dataSource.query("select email from users where id = ?", [userId]);
    if (users[0]?.email !== invitation.email) throw Object.assign(new Error("Invitation email does not match current user"), { statusCode: 403 });

    const existing = await this.dataSource.query("select id from team_members where teamId = ? and userId = ?", [invitation.teamId, userId]);
    let membershipId = existing[0]?.id as string | undefined;
    await this.dataSource.transaction(async (manager) => {
      if (membershipId) {
        await manager.query("update team_members set role = ?, isActive = 1, updatedAt = CURRENT_TIMESTAMP where id = ?", [invitation.role, membershipId]);
      } else {
        membershipId = randomUUID();
        await manager.query("insert into team_members (id, teamId, userId, role, isActive) values (?, ?, ?, ?, 1)", [
          membershipId,
          invitation.teamId,
          userId,
          invitation.role,
        ]);
      }
      await manager.query("update invitations set acceptedAt = CURRENT_TIMESTAMP where id = ?", [invitation.id]);
    });
    return { id: membershipId, teamId: invitation.teamId, userId, role: invitation.role, isActive: true };
  }
}
