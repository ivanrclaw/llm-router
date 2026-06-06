import { randomUUID, createHash } from "crypto";
import type { DataSource } from "typeorm";
import type { Request } from "express";
import { redactSecrets } from "../lib/redaction.js";

export type AuditContext = { ip?: string | null; userAgent?: string | null };

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function auditContextFromRequest(req: Request): AuditContext {
  const forwardedFor = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwardedFor || req.ip || req.socket.remoteAddress || null,
    userAgent: req.header("user-agent") ?? null,
  };
}

export class AuditLogService {
  constructor(private readonly dataSource: DataSource) {}

  async record(input: {
    teamId: string;
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
    context?: AuditContext;
  }): Promise<void> {
    const ipHash = input.context?.ip ? sha256(input.context.ip) : null;
    const userAgentHash = input.context?.userAgent ? sha256(input.context.userAgent) : null;
    await this.dataSource.query(
      `insert into audit_logs (id, teamId, actorUserId, action, resourceType, resourceId, ipHash, userAgentHash, metadataJson)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.teamId,
        input.actorUserId,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        ipHash,
        userAgentHash,
        JSON.stringify(redactSecrets(input.metadata ?? {})),
      ],
    );
  }
}
