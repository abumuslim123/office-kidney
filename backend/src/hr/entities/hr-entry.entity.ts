import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HrList } from './hr-list.entity';

@Entity('hr_entries')
export class HrEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  listId: string;

  @ManyToOne(() => HrList, (l) => l.entries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId' })
  list: HrList;

  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
