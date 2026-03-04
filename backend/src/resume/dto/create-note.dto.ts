import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  authorName: string;
}
