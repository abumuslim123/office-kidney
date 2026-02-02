import { IsString, IsOptional, MinLength, IsDateString } from 'class-validator';

export class UpdateEventDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  color?: string | null;

  @IsString()
  @IsOptional()
  description?: string | null;
}
