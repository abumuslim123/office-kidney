import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  color?: string;
}
