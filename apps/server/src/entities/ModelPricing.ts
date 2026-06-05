import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type { PricingConfidence } from "./ProviderModel.js";

@Entity("model_pricings")
@Index(["providerModelId", "effectiveFrom", "effectiveTo"])
export class ModelPricing {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) providerModelId!: string;
  @Column({ type: "integer", default: "USD" }) currency!: string;
  @Column({ type: "real" }) inputUsdPer1M!: number;
  @Column({ type: "real" }) outputUsdPer1M!: number;
  @Column({ type: "real", nullable: true }) cachedReadUsdPer1M!: number | null;
  @Column({ type: "real", nullable: true }) cachedWriteUsdPer1M!: number | null;
  @Column({ type: "text", default: false }) isFree!: boolean;
  @Column({ type: "text", default: "unknown" }) pricingConfidence!: PricingConfidence;
  @Column({ type: "datetime" }) sourceUrl!: string;
  @Column({ type: "datetime" }) sourceUpdatedAt!: Date;
  @Column({ type: "datetime" }) effectiveFrom!: Date;
  @Column({ type: "datetime", nullable: true }) effectiveTo!: Date | null;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
}
