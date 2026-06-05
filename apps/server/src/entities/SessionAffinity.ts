import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("session_affinities")
@Index(["teamId", "platformApiKeyId", "requestedModel", "sessionKeyHash"], { unique: true })
@Index(["expiresAt"])
export class SessionAffinity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) teamId!: string;
  @Column({ type: "text" }) platformApiKeyId!: string;
  @Column({ type: "text" }) requestedModel!: string;
  @Column({ type: "text" }) sessionKeyHash!: string;
  @Column({ type: "text" }) providerId!: string;
  @Column({ type: "text" }) providerModelId!: string;
  @Column({ type: "text", nullable: true }) lastProviderApiKeyId!: string | null;
  @Column({ type: "datetime" }) expiresAt!: Date;
  @Column({ type: "integer", default: 0 }) hitCount!: number;
  @Column({ type: "integer", default: 0 }) failureCount!: number;
  @Column({ type: "datetime", default: false }) isDegraded!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) firstSeenAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) lastSeenAt!: Date;
}
