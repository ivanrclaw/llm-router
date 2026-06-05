import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("team_members")
@Index(["teamId", "userId"], { unique: true })
export class TeamMember {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() teamId!: string;
  @Column() userId!: string;
  @Column() role!: "owner" | "admin" | "member" | "viewer";
  @Column({ type: "integer", nullable: true }) monthlyBudgetUsdCents!: number | null;
  @Column({ type: "integer", nullable: true }) dailyBudgetUsdCents!: number | null;
  @Column({ default: true }) isActive!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
