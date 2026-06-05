import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("providers")
export class Provider {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Index({ unique: true }) @Column() slug!: string;
  @Column() displayName!: string;
  @Column() baseUrl!: string;
  @Column({ default: true }) isEnabled!: boolean;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) createdAt!: Date;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
