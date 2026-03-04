import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

@Entity('resume_education')
@Index(['candidateId'])
export class ResumeEducation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 300 })
  institution: string;

  @Column({ type: 'varchar', nullable: true })
  faculty: string | null;

  @Column({ type: 'varchar', nullable: true })
  specialty: string | null;

  @Column({ type: 'varchar', nullable: true })
  degree: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'int', nullable: true })
  startYear: number | null;

  @Column({ type: 'int', nullable: true })
  endYear: number | null;

  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => ResumeCandidate, (candidate) => candidate.education, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidateId' })
  candidate: ResumeCandidate;
}
