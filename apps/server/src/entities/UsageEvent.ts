import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("usage_events")
@Index(["teamId", "createdAt"])
@Index(["userId", "createdAt"])
@Index(["platformApiKeyId", "createdAt"])
@Index(["providerModelId", "createdAt"])
@Index(["providerApiKeyId", "createdAt"])
export class UsageEvent {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) requestId!: string;
  @Column({ type: "text" }) teamId!: string;
  @Column({ type: "text" }) userId!: string;
  @Column({ type: "text" }) platformApiKeyId!: string;
  @Column({ type: "text" }) providerId!: string;
  @Column({ type: "text", nullable: true }) providerApiKeyId!: string | null;
  @Column({ type: "text" }) providerModelId!: string;
  @Column({ type: "text" }) requestedModel!: string;
  @Column({ type: "text" }) resolvedModel!: string;
  @Column({ type: "text", nullable: true }) sessionKeyHash!: string | null;
  @Column({ type: "text" }) status!: string;
  @Column({ type: "text", nullable: true }) errorCode!: string | null;
  @Column({ type: "integer", nullable: true }) httpStatus!: number | null;
  @Column({ type: "integer", default: 0 }) promptTokens!: number;
  @Column({ type: "integer", default: 0 }) completionTokens!: number;
  @Column({ type: "integer", default: 0 }) cachedReadTokens!: number;
  @Column({ type: "integer", default: 0 }) cachedWriteTokens!: number;
  @Column({ type: "integer", default: 0 }) totalTokens!: number;
  @Column({ type: "integer", default: 0 }) latencyMs!: number;
  @Column({ type: "integer", default: 0 }) costUsdCents!: number;
  @Column({ type: "integer", default: 0 }) savedUsdCents!: number;
  @Column({ type: "text", nullable: true }) baselineModelId!: string | null;
  @Column({ type: "boolean", default: "unavailable" }) usageSource!: "provider" | "estimated" | "unavailable";
  @Column({ type: "datetime", default: false }) isStreaming!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
}
