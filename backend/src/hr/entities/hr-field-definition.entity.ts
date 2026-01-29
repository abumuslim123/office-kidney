import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HrList } from './hr-list.entity';

export type FieldType = 'text' | 'textarea' | 'date' | 'phone' | 'select' | 'status';

/** For select: string[]. For status: { label: string; color: string }[] */
export type FieldOptions = string[] | { label: string; color: string }[] | null;

@Entity('hr_field_definitions')
export class HrFieldDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  listId: string;

  @ManyToOne(() => HrList, (l) => l.fields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId' })
  list: HrList;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 50 })
  fieldType: FieldType;

  @Column({ type: 'jsonb', nullable: true })
  options: FieldOptions;

  @Column({ type: 'int', default: 0 })
  order: number;
}
