import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

@Entity('resume_work_history')
@Index('IDX_resume_work_history_candidateId', ['candidateId'])
export class ResumeWorkHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 300 })
  organization: string;

  @Column({ length: 300 })
  position: string;

  @Column({ type: 'varchar', nullable: true })
  department: string | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  @Column({ type: 'boolean', default: false })
  isCurrent: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid' })
  candidateId: string;

  @ManyToOne(() => ResumeCandidate, (candidate) => candidate.workHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidateId' })
  candidate: ResumeCandidate;
}
