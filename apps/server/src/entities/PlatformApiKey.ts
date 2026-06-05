import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("platform_api_keys")
@Index(["teamId", "userId", "revokedAt"])
export class PlatformApiKey {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() teamId!: string;
  @Column() userId!: string;
  @Column() name!: string;
  @Column() keyPrefix!: string;
  @Index({ unique: true }) @Column() keyHash!: string;
  @Column({ type: "text", default: "[]" }) scopesJson!: string;
  @Column({ type: "integer", nullable: true }) monthlyBudgetUsdCents!: number | null;
  @Column({ type: "integer", nullable: true }) dailyBudgetUsdCents!: number | null;
  @Column({ type: "integer", nullable: true }) rateLimitRpm!: number | null;
  @Column({ type: "datetime", nullable: true }) lastUsedAt!: Date | null;
  @Column({ type: "datetime", nullable: true }) expiresAt!: Date | null;
  @Column({ type: "datetime", nullable: true }) revokedAt!: Date | null;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
}
