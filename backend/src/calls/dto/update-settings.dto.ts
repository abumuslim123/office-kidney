import { IsOptional, IsString } from 'class-validator';

export class UpdateCallsSettingsDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiBase?: string;

  @IsOptional()
  @IsString()
  audioPath?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  speechkitApiKey?: string;

  @IsOptional()
  @IsString()
  speechkitFolderId?: string;

  @IsOptional()
  @IsString()
  tritechClientId?: string;

  @IsOptional()
  @IsString()
  tritechClientSecret?: string;

  @IsOptional()
  @IsString()
  tritechUsername?: string;

  @IsOptional()
  @IsString()
  tritechPassword?: string;
}
