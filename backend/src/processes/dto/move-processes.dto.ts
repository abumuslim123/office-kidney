import { IsUUID } from 'class-validator';

export class MoveProcessesDto {
  @IsUUID()
  targetDepartmentId: string;
}
