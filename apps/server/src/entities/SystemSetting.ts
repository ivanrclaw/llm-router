import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("system_settings")
export class SystemSetting {
  @PrimaryColumn({ type: "text" }) key!: string;
  @Column({ type: "text" }) valueJson!: string;
  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" }) updatedAt!: Date;
}
