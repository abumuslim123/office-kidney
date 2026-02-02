import { IsString, IsOptional, IsInt, MinLength, IsUUID } from 'class-validator';

export class CreateListDto {
  @IsUUID()
  folderId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  @IsOptional()
  year?: number;
}
