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
@Index('IDX_resume_candidate_notes_candidateId', ['candidateId'])
export class ResumeCandidateNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text' })
  content: string;

  @Column({ length: 200 })
  authorName: string;

  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => ResumeCandidate, (candidate) => candidate.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidateId' })
  candidate: ResumeCandidate;
}
