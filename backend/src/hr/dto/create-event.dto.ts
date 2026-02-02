import { IsString, IsOptional, MinLength, IsDateString } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  description?: string | null;
}
