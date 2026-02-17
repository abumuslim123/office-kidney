import { IsObject, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProcessDto {
  @IsUUID()
  departmentId: string;

  @IsString()
  @MaxLength(300)
  title: string;

  @IsObject()
  descriptionDoc: Record<string, unknown>;
}
