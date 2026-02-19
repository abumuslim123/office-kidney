import { IsString } from 'class-validator';

export class PushUnsubscribeDto {
  @IsString()
  endpoint: string;
}
