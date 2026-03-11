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
import { ResumeLeadStatus, ResumeCandidateDoctorType, ResumeSalaryType } from './resume.enums';
import { ResumeCandidate } from './resume-candidate.entity';
import { ResumeLeadTag } from './resume-lead-tag.entity';

@Entity('resume_leads')
@Index(['status'])
@Index(['phone'])
@Index(['email'])
@Index(['specialization'])
export class ResumeLead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', nullable: true })
  specialization: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  doctorTypes: ResumeCandidateDoctorType[];

  @Column({ type: 'text', array: true, default: '{}' })
  branches: string[];

  @Column({ type: 'int', nullable: true })
  desiredSalary: number | null;

  @Column({ type: 'enum', enum: ResumeSalaryType, nullable: true })
  desiredSalaryType: ResumeSalaryType | null;

  @Column({
    type: 'enum',
    enum: ResumeLeadStatus,
    default: ResumeLeadStatus.NEW,
  })
  status: ResumeLeadStatus;

  @Column({ type: 'uuid', nullable: true })
  convertedCandidateId: string | null;

  @ManyToOne(() => ResumeCandidate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'convertedCandidateId' })
  convertedCandidate: ResumeCandidate | null;

  @OneToMany(() => ResumeLeadTag, (tag) => tag.lead)
  tags: ResumeLeadTag[];
}
