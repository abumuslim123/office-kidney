import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Process } from './process.entity';

@Entity('process_versions')
export class ProcessVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  processId: string;

  @ManyToOne(() => Process, (p) => p.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'processId' })
  process: Process;

  @Column({ type: 'integer' })
  version: number;

  @Column({ type: 'jsonb' })
  descriptionDoc: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  diffData: Record<string, unknown> | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  diffDataCorrections: Array<Record<string, unknown>>;

  @Column({ type: 'uuid' })
  changedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'changedById' })
  changedBy: User;

  @CreateDateColumn()
  changedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  checklist: {
    items?: Array<{ id?: string; title: string; assignee?: string; completed?: boolean }>;
    checklistsByRole?: Array<{
      role: string;
      sections: Array<{
        title: string;
        items: Array<{ title: string; completed?: boolean }>;
      }>;
    }>;
  } | null;
}
