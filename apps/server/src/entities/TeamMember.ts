import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("team_members")
@Index(["teamId", "userId"], { unique: true })
export class TeamMember {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) teamId!: string;
  @Column({ type: "text" }) userId!: string;
  @Column({ type: "integer" }) role!: "owner" | "admin" | "member" | "viewer";
  @Column({ type: "integer", nullable: true }) monthlyBudgetUsdCents!: number | null;
  @Column({ type: "integer", nullable: true }) dailyBudgetUsdCents!: number | null;
  @Column({ type: "datetime", default: true }) isActive!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
