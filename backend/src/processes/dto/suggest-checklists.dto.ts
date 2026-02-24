import { IsString } from 'class-validator';

export class SuggestChecklistsDto {
  @IsString()
  text: string;
}
