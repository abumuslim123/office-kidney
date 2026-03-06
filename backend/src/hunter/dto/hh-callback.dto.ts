import { IsString } from 'class-validator';

export class HhCallbackDto {
  @IsString()
  code: string;
}
