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

@Entity('process_attachments')
export class ProcessAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  processId: string;

  @ManyToOne(() => Process, (p) => p.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'processId' })
  process: Process;

  @Column({ length: 500 })
  path: string;

  @Column({ length: 255 })
  originalName: string;

  @Column({ length: 120 })
  mimeType: string;

  @Column({ type: 'integer' })
  size: number;

  @Column({ type: 'uuid' })
  uploadedById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
