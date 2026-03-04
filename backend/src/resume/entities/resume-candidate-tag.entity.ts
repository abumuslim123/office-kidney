import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

@Entity('resume_candidate_tags')
@Index(['candidateId'])
@Index(['label'])
export class ResumeCandidateTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => ResumeCandidate, (candidate) => candidate.tags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidateId' })
  candidate: ResumeCandidate;
}
