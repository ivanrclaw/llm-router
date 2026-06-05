import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type { PricingConfidence } from "./ProviderModel.js";

@Entity("model_pricings")
@Index(["providerModelId", "effectiveFrom", "effectiveTo"])
export class ModelPricing {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() providerModelId!: string;
  @Column({ default: "USD" }) currency!: string;
  @Column({ type: "real" }) inputUsdPer1M!: number;
  @Column({ type: "real" }) outputUsdPer1M!: number;
  @Column({ type: "real", nullable: true }) cachedReadUsdPer1M!: number | null;
  @Column({ type: "real", nullable: true }) cachedWriteUsdPer1M!: number | null;
  @Column({ default: false }) isFree!: boolean;
  @Column({ default: "unknown" }) pricingConfidence!: PricingConfidence;
  @Column() sourceUrl!: string;
  @Column({ type: "datetime" }) sourceUpdatedAt!: Date;
  @Column({ type: "datetime" }) effectiveFrom!: Date;
  @Column({ type: "datetime", nullable: true }) effectiveTo!: Date | null;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
}
