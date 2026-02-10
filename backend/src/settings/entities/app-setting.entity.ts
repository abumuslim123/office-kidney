import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 200 })
  key: string;

  @Column({ type: 'varchar', length: 2000 })
  value: string;
}

