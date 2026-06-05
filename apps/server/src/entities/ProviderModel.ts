import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export type ProviderEndpointType = "openai_chat_completions" | "openai_responses" | "anthropic_messages" | "google_model_endpoint";
export type PricingConfidence = "docs_pricing_verified" | "live_model_id_inferred" | "manual_admin_override" | "unknown";

@Entity("provider_models")
@Index(["providerId", "externalModelId"], { unique: true })
@Index(["providerId", "endpointType", "isEnabled"])
export class ProviderModel {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) providerId!: string;
  @Column({ type: "text" }) externalModelId!: string;
  @Column({ type: "text" }) displayName!: string;
  @Column({ type: "integer" }) endpointType!: ProviderEndpointType;
  @Column({ type: "integer", nullable: true }) contextWindowTokens!: number | null;
  @Column({ type: "text", default: "[]" }) tagsJson!: string;
  @Column({ type: "text", default: "{}" }) capabilitiesJson!: string;
  @Column({ type: "boolean", default: false }) isFree!: boolean;
  @Column({ type: "text", default: true }) isEnabled!: boolean;
  @Column({ type: "text", default: "unknown" }) pricingConfidence!: PricingConfidence;
  @Column({ type: "text", default: "{}" }) metadataJson!: string;
  @Column({ type: "datetime", nullable: true }) deprecatedAt!: Date | null;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
