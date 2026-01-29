import { IsObject } from 'class-validator';

export class CreateEntryDto {
  @IsObject()
  data: Record<string, unknown>;
}
