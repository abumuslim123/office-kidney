import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

export interface ScoreHighlight {
  type:
    | 'publication'
    | 'rare_specialty'
    | 'top_education'
    | 'unique_experience'
    | 'certification'
    | 'language'
    | 'other';
  text: string;
  importance: 'high' | 'medium' | 'low';
}

@Entity('resume_candidate_scores')
@Index(['candidateId'])
@Index(['totalScore'])
@Index(['specialization'])
export class ResumeCandidateScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => ResumeCandidate, (c) => c.scores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidateId' })
  candidate: ResumeCandidate;

  @Column({ type: 'int', default: 0 })
  totalScore: number;

  @Column({ type: 'text', default: '' })
  aiSummary: string;

  @Column({ type: 'jsonb', default: [] })
  strengths: string[];

  @Column({ type: 'jsonb', default: [] })
  weaknesses: string[];

  @Column({ type: 'jsonb', default: [] })
  highlights: ScoreHighlight[];

  @Column({ type: 'text', default: '' })
  comparison: string;

  @Column({ type: 'float', nullable: true })
  percentileRank: number | null;

  @Column({ type: 'varchar', nullable: true })
  specialization: string | null;

  @Column({ type: 'int', default: 0 })
  totalCandidatesInGroup: number;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'boolean', default: true })
  isCurrent: boolean;

  @Column({ type: 'varchar', nullable: true })
  modelVersion: string | null;

  // ─── Sub-scores (гибридная система) ───

  @Column({ type: 'float', nullable: true })
  experienceScore: number | null;

  @Column({ type: 'float', nullable: true })
  educationScore: number | null;

  @Column({ type: 'float', nullable: true })
  qualificationScore: number | null;

  @Column({ type: 'float', nullable: true })
  developmentScore: number | null;

  @Column({ type: 'float', nullable: true })
  aiQualitativeScore: number | null;

  @Column({ type: 'float', nullable: true })
  deterministicScore: number | null;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;
}
