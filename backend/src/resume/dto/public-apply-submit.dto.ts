import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class PublicApplySubmitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  fullName: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

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

  // Wizard step data
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
}
