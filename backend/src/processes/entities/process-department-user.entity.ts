import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProcessDepartment } from './process-department.entity';

@Entity('process_department_users')
@Unique('UQ_process_department_users_department_user', ['departmentId', 'userId'])
export class ProcessDepartmentUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  departmentId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => ProcessDepartment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'departmentId' })
  department: ProcessDepartment;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
