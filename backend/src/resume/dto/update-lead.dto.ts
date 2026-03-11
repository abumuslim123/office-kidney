import { IsEnum, IsOptional } from 'class-validator';
import { CreateLeadDto } from './create-lead.dto';
import { ResumeLeadStatus } from '../entities/resume.enums';

export class UpdateLeadDto extends CreateLeadDto {
  @IsEnum(ResumeLeadStatus)
  @IsOptional()
  status?: ResumeLeadStatus;
}
