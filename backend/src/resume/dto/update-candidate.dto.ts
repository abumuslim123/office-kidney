import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ResumeCandidatePriority,
  ResumeCandidateStatus,
  ResumeQualificationCategory,
} from '../entities/resume.enums';

export class UpdateCandidateDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialization?: string | null;

  @IsOptional()
  @IsEnum(ResumeQualificationCategory)
  qualificationCategory?: ResumeQualificationCategory;

  @IsOptional()
  @IsEnum(ResumeCandidateStatus)
  status?: ResumeCandidateStatus;

  @IsOptional()
  @IsEnum(ResumeCandidatePriority)
  priority?: ResumeCandidatePriority;

  @IsOptional()
  @IsArray()
  branches?: string[];

  @IsOptional()
  @IsString()
  rawText?: string | null;

  @IsOptional()
  @IsString()
  publications?: string | null;

  @IsOptional()
  @IsString()
  additionalSkills?: string | null;

  @IsOptional()
  @IsNumber()
  nmoPoints?: number | null;

  @IsOptional()
  @IsNumber()
  totalExperienceYears?: number | null;

  @IsOptional()
  @IsNumber()
  specialtyExperienceYears?: number | null;

  @IsOptional()
  @IsBoolean()
  accreditationStatus?: boolean;

  @IsOptional()
  @IsString()
  accreditationExpiryDate?: string | null;
}
