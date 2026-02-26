import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateResumeTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;
}
