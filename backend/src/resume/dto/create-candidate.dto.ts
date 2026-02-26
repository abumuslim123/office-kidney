import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  rawText: string;
}
