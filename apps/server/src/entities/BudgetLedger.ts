import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("budget_ledgers")
@Index(["scopeType", "scopeId", "periodType", "periodKey"], { unique: true })
export class BudgetLedger {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() scopeType!: string;
  @Column() scopeId!: string;
  @Column() periodType!: "daily" | "monthly";
  @Column() periodKey!: string;
  @Column({ type: "integer", default: 0 }) spentUsdCents!: number;
  @Column({ type: "integer", default: 0 }) reservedUsdCents!: number;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
