import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DiffCorrectionDto {
  @IsInt()
  @Min(0)
  changeIndex: number;

  @IsOptional()
  @IsString()
  overrideNewText?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateVersionCorrectionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DiffCorrectionDto)
  corrections: DiffCorrectionDto[];
}
