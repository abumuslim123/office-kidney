import { IsString, IsOptional, MinLength, IsDateString } from 'class-validator';

export class UpdateEventDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  title?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  description?: string | null;
}
