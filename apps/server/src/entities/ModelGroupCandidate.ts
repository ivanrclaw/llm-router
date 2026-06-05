import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("model_group_candidates")
@Index(["modelGroupId", "priority", "weight"])
export class ModelGroupCandidate {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) modelGroupId!: string;
  @Column({ type: "integer" }) providerModelId!: string;
  @Column({ type: "integer", default: 100 }) priority!: number;
  @Column({ type: "integer", default: 1 }) weight!: number;
  @Column({ type: "text", default: true }) isEnabled!: boolean;
  @Column({ type: "text", default: "{}" }) constraintsJson!: string;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
