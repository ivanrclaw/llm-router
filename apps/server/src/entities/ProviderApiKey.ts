import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("provider_api_keys")
@Index(["teamId", "providerId", "isEnabled", "priority"])
@Index(["cooldownUntil"])
export class ProviderApiKey {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() teamId!: string;
  @Column() providerId!: string;
  @Column() name!: string;
  @Column() keyPrefix!: string;
  @Column() encryptedKey!: string;
  @Column({ type: "integer", default: 100 }) priority!: number;
  @Column({ type: "integer", nullable: true }) monthlyBudgetUsdCents!: number | null;
  @Column({ type: "integer", nullable: true }) dailyBudgetUsdCents!: number | null;
  @Column({ type: "integer", nullable: true }) rpmLimit!: number | null;
  @Column({ default: true }) isEnabled!: boolean;
  @Column({ default: "unknown" }) healthStatus!: string;
  @Column({ type: "datetime", nullable: true }) lastValidatedAt!: Date | null;
  @Column({ type: "datetime", nullable: true }) lastUsedAt!: Date | null;
  @Column({ type: "datetime", nullable: true }) lastErrorAt!: Date | null;
  @Column({ type: "text", nullable: true }) lastErrorCode!: string | null;
  @Column({ type: "datetime", nullable: true }) cooldownUntil!: Date | null;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
