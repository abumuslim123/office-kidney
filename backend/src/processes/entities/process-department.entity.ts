import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Process } from './process.entity';

@Entity('process_departments')
export class ProcessDepartment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => ProcessDepartment, (d) => d.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent: ProcessDepartment | null;

  @OneToMany(() => ProcessDepartment, (d) => d.parent)
  children: ProcessDepartment[];

  @OneToMany(() => Process, (p) => p.department)
  processes: Process[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
