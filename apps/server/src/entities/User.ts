import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "text" })
  email!: string;

  @Column({ type: "text" })
  name!: string;

  @Column({ type: "text" })
  passwordHash!: string;

  @Column({ type: "text", default: "en" })
  locale!: string;

  @Column({ type: "text", default: "UTC" })
  timezone!: string;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "datetime", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
