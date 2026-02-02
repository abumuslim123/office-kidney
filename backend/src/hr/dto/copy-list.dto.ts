import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CopyListDto {
  @IsUUID()
  @IsOptional()
  folderId?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;
}
