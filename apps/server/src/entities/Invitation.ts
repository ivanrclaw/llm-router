import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("invitations")
@Index(["teamId", "email"])
export class Invitation {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column() teamId!: string;
  @Column() email!: string;
  @Column() role!: "admin" | "member" | "viewer";
  @Column() tokenHash!: string;
  @Column({ type: "datetime" }) expiresAt!: Date;
  @Column({ type: "datetime", nullable: true }) acceptedAt!: Date | null;
  @Column() createdByUserId!: string;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
}
