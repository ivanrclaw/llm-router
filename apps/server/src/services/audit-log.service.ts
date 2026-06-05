import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";

export class AuditLogService {
  constructor(private readonly dataSource: DataSource) {}

  async record(input: {
    teamId: string;
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.dataSource.query(
      `insert into audit_logs (id, teamId, actorUserId, action, resourceType, resourceId, metadataJson)
       values (?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.teamId,
        input.actorUserId,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }
}
