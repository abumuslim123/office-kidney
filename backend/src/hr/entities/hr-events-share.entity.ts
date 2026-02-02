import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('hr_events_share')
export class HrEventsShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 255, default: '' })
  token: string;
}
