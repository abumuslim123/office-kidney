import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('resume_specializations')
export class ResumeSpecialization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'text', array: true, default: '{}' })
  aliases: string[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
