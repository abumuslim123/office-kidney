import { IsString, IsOptional, IsInt, MinLength } from 'class-validator';

export class UpdateListDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  year?: number | null;
}
