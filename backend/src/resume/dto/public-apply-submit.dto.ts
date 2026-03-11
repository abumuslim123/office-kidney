import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsUUID } from 'class-validator';

class WorkHistoryItemDto {
  @IsString()
  @MinLength(1)
  organization: string;

  @IsString()
  @MinLength(1)
  position: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsOptional()
  isCurrent?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

class EducationItemDto {
  @IsString()
  @MinLength(1)
  institution: string;

  @IsString()
  @IsOptional()
  faculty?: string;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  @IsOptional()
  degree?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsOptional()
  startYear?: number;

  @IsOptional()
  endYear?: number;

  @IsString()
  @IsOptional()
  type?: string;
}

class CmeCourseItemDto {
  @IsString()
  @MinLength(1)
  courseName: string;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsString()
  @IsOptional()
  completedAt?: string;

  @IsNumber()
  @IsOptional()
  hours?: number | null;

  @IsNumber()
  @IsOptional()
  nmoPoints?: number | null;

  @IsString()
  @IsOptional()
  certificateNumber?: string;
}

export class PublicApplySubmitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  fullName: string;

  // Пустая строка допустима — валидируем email только если значение непустое
  @ValidateIf((o) => o.email !== '' && o.email != null)
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  specialization?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50000)
  rawText?: string;

  @IsUUID()
  @IsOptional()
  uploadedFileId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  branches?: string[];

  // Honeypot field — if filled, it's a bot
  @IsString()
  @IsOptional()
  website?: string;

  // ─── Образование (верхнеуровневые поля) ─────────────────────────────────

  @IsString()
  @IsOptional()
  university?: string;

  @IsString()
  @IsOptional()
  faculty?: string;

  @IsNumber()
  @IsOptional()
  graduationYear?: number | null;

  @IsString()
  @IsOptional()
  internshipPlace?: string;

  @IsString()
  @IsOptional()
  internshipSpecialty?: string;

  @IsNumber()
  @IsOptional()
  internshipYearEnd?: number | null;

  @IsString()
  @IsOptional()
  residencyPlace?: string;

  @IsString()
  @IsOptional()
  residencySpecialty?: string;

  @IsNumber()
  @IsOptional()
  residencyYearEnd?: number | null;

  // ─── Специализация / квалификация ───────────────────────────────────────

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  additionalSpecializations?: string[];

  @IsString()
  @IsOptional()
  qualificationCategory?: string;

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

  // ─── Опыт ──────────────────────────────────────────────────────────────

  @IsNumber()
  @IsOptional()
  totalExperienceYears?: number | null;

  @IsNumber()
  @IsOptional()
  specialtyExperienceYears?: number | null;

  // ─── Желаемая ЗП ──────────────────────────────────────────────────────

  @IsNumber()
  @IsOptional()
  desiredSalary?: number | null;

  @IsString()
  @IsOptional()
  desiredSalaryType?: string;

  // ─── Дополнительно ─────────────────────────────────────────────────────

  @IsNumber()
  @IsOptional()
  nmoPoints?: number | null;

  @IsString()
  @IsOptional()
  publications?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsString()
  @IsOptional()
  additionalSkills?: string;

  // ─── Связанные коллекции ────────────────────────────────────────────────

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkHistoryItemDto)
  @IsOptional()
  workHistory?: WorkHistoryItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationItemDto)
  @IsOptional()
  education?: EducationItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CmeCourseItemDto)
  @IsOptional()
  cmeCourses?: CmeCourseItemDto[];

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  freeFormNote?: string;

  // ─── UI-only поля (разрешены, но не сохраняются) ────────────────────────

  @IsBoolean()
  @IsOptional()
  consentToDataProcessing?: boolean;
}