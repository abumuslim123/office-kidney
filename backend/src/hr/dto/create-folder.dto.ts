import { IsString, MinLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  name: string;
}
