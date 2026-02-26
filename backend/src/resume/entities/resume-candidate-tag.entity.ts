import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

@Entity('resume_candidate_tags')
@Index('IDX_resume_candidate_tags_candidateId', ['candidateId'])
@Index('IDX_resume_candidate_tags_label', ['label'])
export class ResumeCandidateTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  label: string;

  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => ResumeCandidate, (candidate) => candidate.tags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidateId' })
  candidate: ResumeCandidate;
}
