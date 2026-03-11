import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResumeLead } from './resume-lead.entity';

@Entity('resume_lead_tags')
@Index(['leadId'])
@Index(['label'])
export class ResumeLeadTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'uuid' })
  leadId: string;

  @ManyToOne(() => ResumeLead, (lead) => lead.tags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'leadId' })
  lead: ResumeLead;
}
