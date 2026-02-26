import { Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ResumeCandidate } from './resume-candidate.entity';

@Entity('resume_uploaded_files')
export class ResumeUploadedFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ length: 500 })
  originalName: string;

  @Column({ length: 1000 })
  storedPath: string;

  @Column({ length: 255 })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @OneToOne(() => ResumeCandidate, (candidate) => candidate.uploadedFile)
  candidate: ResumeCandidate | null;
}
