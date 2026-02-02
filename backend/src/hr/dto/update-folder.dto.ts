import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdateFolderDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;
}
