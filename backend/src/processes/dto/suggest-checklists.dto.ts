import { IsOptional, IsString } from 'class-validator';

export class SuggestChecklistsDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  exampleText?: string;
}
