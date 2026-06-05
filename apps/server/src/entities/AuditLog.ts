import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("audit_logs")
@Index(["teamId", "createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() teamId!: string;
  @Column({ type: "text", nullable: true }) actorUserId!: string | null;
  @Column() action!: string;
  @Column() resourceType!: string;
  @Column({ type: "text", nullable: true }) resourceId!: string | null;
  @Column({ type: "text", nullable: true }) ipHash!: string | null;
  @Column({ type: "text", nullable: true }) userAgentHash!: string | null;
  @Column({ type: "text", default: "{}" }) metadataJson!: string;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
}
