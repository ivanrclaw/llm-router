import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("teams")
export class Team {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() name!: string;
  @Index({ unique: true }) @Column() slug!: string;
  @Column() ownerId!: string;
  @Column({ type: "integer", nullable: true }) defaultMonthlyBudgetUsdCents!: number | null;
  @Column({ type: "integer", nullable: true }) defaultDailyBudgetUsdCents!: number | null;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
