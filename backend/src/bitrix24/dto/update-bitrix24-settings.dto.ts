import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBitrix24SettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  webhookUrl?: string;
}
