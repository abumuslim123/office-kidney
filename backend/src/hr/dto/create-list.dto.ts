import { IsString, IsOptional, IsInt, MinLength } from 'class-validator';

export class CreateListDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @IsOptional()
  year?: number;
}
