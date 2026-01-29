import { IsString, IsIn, IsOptional, IsArray, IsInt, MinLength, ValidateIf, ValidateBy, ValidationArguments } from 'class-validator';

export class CreateFieldDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsIn(['text', 'textarea', 'date', 'phone', 'select', 'status'])
  fieldType: 'text' | 'textarea' | 'date' | 'phone' | 'select' | 'status';

  @ValidateIf((o: CreateFieldDto) => o.fieldType === 'select' || o.fieldType === 'status')
  @IsArray()
  @ValidateBy({
    name: 'fieldOptions',
    validator: {
      validate(value: unknown, args?: ValidationArguments) {
        const dto = args?.object as CreateFieldDto | undefined;
        if (!dto) return false;
        if (!Array.isArray(value)) return false;
        if (dto.fieldType === 'select') {
          return value.every((v) => typeof v === 'string');
        }
        if (dto.fieldType === 'status') {
          return value.every(
            (v) =>
              v &&
              typeof v === 'object' &&
              'label' in v &&
              'color' in v &&
              typeof (v as { label: unknown }).label === 'string' &&
              typeof (v as { color: unknown }).color === 'string',
          );
        }
        return true;
      },
      defaultMessage() {
        return 'options: for select use string[], for status use { label, color }[]';
      },
    },
  })
  @IsOptional()
  options?: string[] | { label: string; color: string }[];

  @IsInt()
  @IsOptional()
  order?: number;
}
