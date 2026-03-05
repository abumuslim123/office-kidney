import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsNumber,
  IsArray,
  MinLength,
} from 'class-validator';
import {
  ResumeQualificationCategory,
  ResumeCandidateStatus,
  ResumeCandidatePriority,
  ResumeCandidateGender,
  ResumeCandidateDoctorType,
} from '../entities/resume.enums';

export class UpdateCandidateDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  university?: string;

  @IsString()
  @IsOptional()
  faculty?: string;

  @IsInt()
  @IsOptional()
  graduationYear?: number;

  @IsString()
  @IsOptional()
  internshipPlace?: string;

  @IsString()
  @IsOptional()
  internshipSpecialty?: string;

  @IsInt()
  @IsOptional()
  internshipYearEnd?: number;

  @IsString()
  @IsOptional()
  residencyPlace?: string;

  @IsString()
  @IsOptional()
  residencySpecialty?: string;

  @IsInt()
  @IsOptional()
  residencyYearEnd?: number;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  additionalSpecializations?: string[];

  @IsEnum(ResumeQualificationCategory)
  @IsOptional()
  qualificationCategory?: ResumeQualificationCategory;

  @IsString()
  @IsOptional()
  categoryAssignedDate?: string;

  @IsString()
  @IsOptional()
  categoryExpiryDate?: string;

  @IsBoolean()
  @IsOptional()
  accreditationStatus?: boolean;

  @IsString()
  @IsOptional()
  accreditationDate?: string;

  @IsString()
  @IsOptional()
  accreditationExpiryDate?: string;

  @IsString()
  @IsOptional()
  certificateNumber?: string;

  @IsString()
  @IsOptional()
  certificateIssueDate?: string;

  @IsString()
  @IsOptional()
  certificateExpiryDate?: string;

  @IsNumber()
  @IsOptional()
  totalExperienceYears?: number;

  @IsNumber()
  @IsOptional()
  specialtyExperienceYears?: number;

  @IsInt()
  @IsOptional()
  nmoPoints?: number;

  @IsString()
  @IsOptional()
  publications?: string;

  @IsString()
  @IsOptional()
  additionalSkills?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branches?: string[];

  @IsEnum(ResumeCandidateStatus)
  @IsOptional()
  status?: ResumeCandidateStatus;

  @IsEnum(ResumeCandidatePriority)
  @IsOptional()
  priority?: ResumeCandidatePriority;

  @IsEnum(ResumeCandidateGender)
  @IsOptional()
  gender?: ResumeCandidateGender;

  @IsArray()
  @IsEnum(ResumeCandidateDoctorType, { each: true })
  @IsOptional()
  doctorTypes?: ResumeCandidateDoctorType[];
}
