import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

@Entity('resume_cme_courses')
@Index(['candidateId'])
export class ResumeCmeCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  courseName: string;

  @Column({ type: 'varchar', nullable: true })
  provider: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  hours: number | null;

  @Column({ type: 'int', nullable: true })
  nmoPoints: number | null;

  @Column({ type: 'varchar', nullable: true })
  certificateNumber: string | null;

  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => ResumeCandidate, (candidate) => candidate.cmeCourses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidateId' })
  candidate: ResumeCandidate;
}
