import { IsString, IsOptional, MaxLength, IsArray, IsNumber } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsOptional()
  @MaxLength(300)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  specialization?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  source?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  doctorTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branches?: string[];

  @IsOptional()
  @IsNumber()
  desiredSalary?: number;

  @IsOptional()
  @IsString()
  desiredSalaryType?: string;
}
