import { IsString, IsOptional, IsNumber } from 'class-validator';

export class TelegramIngestDto {
  @IsNumber()
  chatId: number;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  rawText?: string;

  @IsString()
  @IsOptional()
  fileBase64?: string;

  @IsString()
  @IsOptional()
  fileName?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;
}
