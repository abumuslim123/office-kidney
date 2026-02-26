import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateResumeNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  authorName: string;
}
