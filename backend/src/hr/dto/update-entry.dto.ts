import { IsObject, IsOptional } from 'class-validator';

export class UpdateEntryDto {
  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}
