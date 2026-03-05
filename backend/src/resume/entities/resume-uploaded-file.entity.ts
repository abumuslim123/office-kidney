import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

@Entity('resume_uploaded_files')
export class ResumeUploadedFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 500 })
  originalName: string;

  @Column({ type: 'varchar', length: 1000 })
  storedPath: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @OneToOne(() => ResumeCandidate, (candidate) => candidate.uploadedFile, {
    nullable: true,
  })
  candidate: ResumeCandidate | null;
}
