import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("usage_daily_aggregates")
@Index(["date", "teamId", "userId", "modelId", "platformApiKeyId", "providerApiKeyId"])
export class UsageDailyAggregate {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() date!: string;
  @Column() teamId!: string;
  @Column({ type: "text", nullable: true }) userId!: string | null;
  @Column({ type: "text", nullable: true }) platformApiKeyId!: string | null;
  @Column({ type: "text", nullable: true }) modelId!: string | null;
  @Column({ type: "text", nullable: true }) providerApiKeyId!: string | null;
  @Column({ type: "integer", default: 0 }) requestCount!: number;
  @Column({ type: "integer", default: 0 }) successCount!: number;
  @Column({ type: "integer", default: 0 }) errorCount!: number;
  @Column({ type: "integer", default: 0 }) promptTokens!: number;
  @Column({ type: "integer", default: 0 }) completionTokens!: number;
  @Column({ type: "integer", default: 0 }) cachedReadTokens!: number;
  @Column({ type: "integer", default: 0 }) cachedWriteTokens!: number;
  @Column({ type: "integer", default: 0 }) costUsdCents!: number;
  @Column({ type: "integer", default: 0 }) savedUsdCents!: number;
  @Column({ type: "integer", default: 0 }) avgLatencyMs!: number;
  @Column({ type: "integer", default: 0 }) p50LatencyMs!: number;
  @Column({ type: "integer", default: 0 }) p95LatencyMs!: number;
}
