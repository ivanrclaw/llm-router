import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("invitations")
@Index(["teamId", "email"])
export class Invitation {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ type: "text" }) teamId!: string;
  @Column({ type: "text" }) email!: string;
  @Column({ type: "text" }) role!: "admin" | "member" | "viewer";
  @Column({ type: "datetime" }) tokenHash!: string;
  @Column({ type: "datetime" }) expiresAt!: Date;
  @Column({ type: "datetime", nullable: true }) acceptedAt!: Date | null;
  @Column({ type: "datetime" }) createdByUserId!: string;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
}
