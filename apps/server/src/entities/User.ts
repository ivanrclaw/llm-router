import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column()
  email!: string;

  @Column()
  name!: string;

  @Column()
  passwordHash!: string;

  @Column({ default: "en" })
  locale!: string;

  @Column({ default: "UTC" })
  timezone!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: "datetime", nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
