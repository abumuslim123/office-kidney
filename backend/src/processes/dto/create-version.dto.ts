import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

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
    items?: Array<{ title: string; assignee?: string }>;
    checklistsByRole?: Array<{
      role: string;
      sections: Array<{ title: string; items: Array<{ title: string }> }>;
    }>;
  };

  @IsOptional()
  @IsBoolean()
  isIteration?: boolean;

  @IsOptional()
  @IsString()
  changeReason?: string;
}
