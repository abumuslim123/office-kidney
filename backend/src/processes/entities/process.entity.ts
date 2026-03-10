import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProcessDepartment } from './process-department.entity';
import { ProcessAttachment } from './process-attachment.entity';
import { ProcessVersion } from './process-version.entity';

@Entity('processes')
@Index('IDX_processes_department', ['departmentId'])
export class Process {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  departmentId: string;

  @ManyToOne(() => ProcessDepartment, (d) => d.processes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'departmentId' })
  department: ProcessDepartment;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  currentDescriptionDoc: Record<string, unknown>;

  @Column({ type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @OneToMany(() => ProcessAttachment, (a) => a.process)
  attachments: ProcessAttachment[];

  @OneToMany(() => ProcessVersion, (v) => v.process)
  versions: ProcessVersion[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
