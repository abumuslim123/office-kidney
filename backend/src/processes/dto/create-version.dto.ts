import { IsObject, IsOptional } from 'class-validator';

export class CreateVersionDto {
  @IsObject()
  descriptionDoc: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  diffData?: {
    changes: Array<{
      blockIndex: number;
      changeType: string;
      oldText: string;
      newText: string;
      changedByName?: string;
      changedAt?: string;
    }>;
  };

  @IsOptional()
  @IsObject()
  checklist?: {
    items: Array<{ title: string; assignee?: string }>;
  };
}
