import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("usage_events")
@Index(["teamId", "createdAt"])
@Index(["userId", "createdAt"])
@Index(["platformApiKeyId", "createdAt"])
@Index(["providerModelId", "createdAt"])
@Index(["providerApiKeyId", "createdAt"])
export class UsageEvent {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() requestId!: string;
  @Column() teamId!: string;
  @Column() userId!: string;
  @Column() platformApiKeyId!: string;
  @Column() providerId!: string;
  @Column({ type: "text", nullable: true }) providerApiKeyId!: string | null;
  @Column() providerModelId!: string;
  @Column() requestedModel!: string;
  @Column() resolvedModel!: string;
  @Column({ type: "text", nullable: true }) sessionKeyHash!: string | null;
  @Column() status!: string;
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
  @Column({ default: "unavailable" }) usageSource!: "provider" | "estimated" | "unavailable";
  @Column({ default: false }) isStreaming!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
}
