import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("session_affinities")
@Index(["teamId", "platformApiKeyId", "requestedModel", "sessionKeyHash"], { unique: true })
@Index(["expiresAt"])
export class SessionAffinity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() teamId!: string;
  @Column() platformApiKeyId!: string;
  @Column() requestedModel!: string;
  @Column() sessionKeyHash!: string;
  @Column() providerId!: string;
  @Column() providerModelId!: string;
  @Column({ type: "text", nullable: true }) lastProviderApiKeyId!: string | null;
  @Column({ type: "datetime" }) expiresAt!: Date;
  @Column({ type: "integer", default: 0 }) hitCount!: number;
  @Column({ type: "integer", default: 0 }) failureCount!: number;
  @Column({ default: false }) isDegraded!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) firstSeenAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) lastSeenAt!: Date;
}
