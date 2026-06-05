import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("budget_ledgers")
@Index(["scopeType", "scopeId", "periodType", "periodKey"], { unique: true })
export class BudgetLedger {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) scopeType!: string;
  @Column({ type: "text" }) scopeId!: string;
  @Column({ type: "text" }) periodType!: "daily" | "monthly";
  @Column({ type: "integer" }) periodKey!: string;
  @Column({ type: "integer", default: 0 }) spentUsdCents!: number;
  @Column({ type: "integer", default: 0 }) reservedUsdCents!: number;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
