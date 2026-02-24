import { IsArray, IsUUID } from 'class-validator';

export class SetDepartmentUsersDto {
  @IsArray()
  @IsUUID('4', { each: true })
  userIds: string[];
}
