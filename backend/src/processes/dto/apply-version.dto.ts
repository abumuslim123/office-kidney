import { IsUUID } from 'class-validator';

export class ApplyVersionDto {
  @IsUUID()
  versionId: string;
}
