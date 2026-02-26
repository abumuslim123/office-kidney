import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class PublicApplySubmitDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialization?: string;

  @IsOptional()
  @IsString()
  rawText?: string;

  @IsOptional()
  @IsString()
  uploadedFileId?: string;

  @IsOptional()
  @IsArray()
  branches?: string[];
}
