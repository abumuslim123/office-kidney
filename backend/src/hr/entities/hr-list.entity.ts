import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { HrFieldDefinition } from './hr-field-definition.entity';
import { HrEntry } from './hr-entry.entity';

@Entity('hr_lists')
export class HrList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @OneToMany(() => HrFieldDefinition, (f) => f.list)
  fields: HrFieldDefinition[];

  @OneToMany(() => HrEntry, (e) => e.list)
  entries: HrEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
