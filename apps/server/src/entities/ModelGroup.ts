import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("model_groups")
@Index(["teamId", "alias"], { unique: true })
export class ModelGroup {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text", nullable: true }) teamId!: string | null;
  @Column({ type: "text" }) alias!: string;
  @Column({ type: "text" }) displayName!: string;
  @Column({ type: "text", nullable: true }) description!: string | null;
  @Column({ type: "text", default: "{}" }) policyJson!: string;
  @Column({ type: "integer", default: 86400 }) stickySessionTtlSeconds!: number;
  @Column({ type: "boolean", default: true }) isEnabled!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
