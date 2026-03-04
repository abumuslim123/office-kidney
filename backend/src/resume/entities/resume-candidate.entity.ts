import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ResumeCandidateDoctorType,
  ResumeCandidateGender,
  ResumeCandidatePriority,
  ResumeCandidateStatus,
  ResumeProcessingStatus,
  ResumeQualificationCategory,
} from './resume.enums';
import { ResumeUploadedFile } from './resume-uploaded-file.entity';
import { ResumeWorkHistory } from './resume-work-history.entity';
import { ResumeEducation } from './resume-education.entity';
import { ResumeCmeCourse } from './resume-cme-course.entity';
import { ResumeCandidateNote } from './resume-candidate-note.entity';
import { ResumeCandidateTag } from './resume-candidate-tag.entity';

@Entity('resume_candidates')
@Index(['specialization'])
@Index(['qualificationCategory'])
@Index(['status'])
@Index(['priority'])
@Index(['branches'])
@Index(['processingStatus'])
@Index(['accreditationExpiryDate'])
@Index(['phone'])
@Index(['email'])
@Index(['doctorTypes'])
export class ResumeCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'varchar' })
  fullName: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'timestamp', nullable: true })
  birthDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 10, default: 'UNKNOWN' })
  gender: ResumeCandidateGender;

  @Column({ type: 'text', array: true, default: '{}' })
  doctorTypes: ResumeCandidateDoctorType[];

  @Column({ type: 'varchar', nullable: true })
  university: string | null;

  @Column({ type: 'varchar', nullable: true })
  faculty: string | null;

  @Column({ type: 'int', nullable: true })
  graduationYear: number | null;

  @Column({ type: 'varchar', nullable: true })
  internshipPlace: string | null;

  @Column({ type: 'varchar', nullable: true })
  internshipSpecialty: string | null;

  @Column({ type: 'int', nullable: true })
  internshipYearEnd: number | null;

  @Column({ type: 'varchar', nullable: true })
  residencyPlace: string | null;

  @Column({ type: 'varchar', nullable: true })
  residencySpecialty: string | null;

  @Column({ type: 'int', nullable: true })
  residencyYearEnd: number | null;

  @Column({ type: 'varchar', nullable: true })
  specialization: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  additionalSpecializations: string[];

  @Column({
    type: 'enum',
    enum: ResumeQualificationCategory,
    default: ResumeQualificationCategory.NONE,
  })
  qualificationCategory: ResumeQualificationCategory;

  @Column({ type: 'timestamp', nullable: true })
  categoryAssignedDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  categoryExpiryDate: Date | null;

  @Column({ type: 'boolean', default: false })
  accreditationStatus: boolean;

  @Column({ type: 'timestamp', nullable: true })
  accreditationDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  accreditationExpiryDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  certificateNumber: string | null;

  @Column({ type: 'timestamp', nullable: true })
  certificateIssueDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  certificateExpiryDate: Date | null;

  @Column({ type: 'float', nullable: true })
  totalExperienceYears: number | null;

  @Column({ type: 'float', nullable: true })
  specialtyExperienceYears: number | null;

  @Column({ type: 'int', nullable: true })
  nmoPoints: number | null;

  @Column({ type: 'text', nullable: true })
  publications: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  languages: string[];

  @Column({ type: 'text', nullable: true })
  additionalSkills: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  branches: string[];

  @Column({
    type: 'enum',
    enum: ResumeCandidateStatus,
    default: ResumeCandidateStatus.NEW,
  })
  status: ResumeCandidateStatus;

  @Column({
    type: 'enum',
    enum: ResumeCandidatePriority,
    default: ResumeCandidatePriority.ACTIVE,
  })
  priority: ResumeCandidatePriority;

  @Column({
    type: 'enum',
    enum: ResumeProcessingStatus,
    default: ResumeProcessingStatus.PENDING,
  })
  processingStatus: ResumeProcessingStatus;

  @Column({ type: 'text', nullable: true })
  processingError: string | null;

  @Column({ type: 'text', nullable: true })
  rawText: string | null;

  @Column({ type: 'float', nullable: true })
  aiConfidence: number | null;

  @Column({ type: 'uuid', nullable: true, unique: true })
  uploadedFileId: string | null;

  @ManyToOne(() => ResumeUploadedFile, (file) => file.candidate, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'uploadedFileId' })
  uploadedFile: ResumeUploadedFile | null;

  @OneToMany(() => ResumeWorkHistory, (wh) => wh.candidate)
  workHistory: ResumeWorkHistory[];

  @OneToMany(() => ResumeEducation, (edu) => edu.candidate)
  education: ResumeEducation[];

  @OneToMany(() => ResumeCmeCourse, (course) => course.candidate)
  cmeCourses: ResumeCmeCourse[];

  @OneToMany(() => ResumeCandidateNote, (note) => note.candidate)
  notes: ResumeCandidateNote[];

  @OneToMany(() => ResumeCandidateTag, (tag) => tag.candidate)
  tags: ResumeCandidateTag[];
}
