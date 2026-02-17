import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateProcessDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;
}
