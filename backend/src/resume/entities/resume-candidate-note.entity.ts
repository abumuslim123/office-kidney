import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

@Entity('resume_candidate_notes')
@Index(['candidateId'])
export class ResumeCandidateNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 200 })
  authorName: string;

  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => ResumeCandidate, (candidate) => candidate.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidateId' })
  candidate: ResumeCandidate;
}
