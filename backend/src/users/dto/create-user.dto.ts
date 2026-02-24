import { IsEmail, IsString, IsUUID, IsBoolean, IsOptional, MinLength, IsArray } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  login: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsUUID()
  roleId: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  permissionIds?: string[];
}
