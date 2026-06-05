import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("providers")
export class Provider {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index({ unique: true }) @Column({ type: "text" }) slug!: string;
  @Column({ type: "text" }) displayName!: string;
  @Column({ type: "boolean" }) baseUrl!: string;
  @Column({ type: "datetime", default: true }) isEnabled!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
