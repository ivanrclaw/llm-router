import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("budget_policies")
export class BudgetPolicy {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) scopeType!: string;
  @Column({ type: "integer" }) scopeId!: string;
  @Column({ type: "integer", nullable: true }) monthlyBudgetUsdCents!: number | null;
  @Column({ type: "integer", nullable: true }) dailyBudgetUsdCents!: number | null;
  @Column({ type: "text", default: true }) hardLimit!: boolean;
  @Column({ type: "text", default: "[]" }) alertThresholdsJson!: string;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
