import { IsObject } from 'class-validator';

export class CreateVersionDto {
  @IsObject()
  descriptionDoc: Record<string, unknown>;
}
