import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProcessVersion } from './process-version.entity';
import { Process } from './process.entity';

export type ProcessActivityActionType =
  | 'view_process'
  | 'view_version'
  | 'acknowledge_latest'
  | 'checklist_approved';

@Entity('process_activity_log')
export class ProcessActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  processId: string;

  @ManyToOne(() => Process, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'processId' })
  process: Process;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  versionId: string | null;

  @ManyToOne(() => ProcessVersion, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'versionId' })
  version: ProcessVersion | null;

  @Column({ type: 'varchar', length: 64 })
  actionType: ProcessActivityActionType;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
