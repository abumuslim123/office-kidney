import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { HrFolder } from './hr-folder.entity';
import { HrFieldDefinition } from './hr-field-definition.entity';
import { HrEntry } from './hr-entry.entity';

@Entity('hr_lists')
export class HrList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  folderId: string;

  @ManyToOne(() => HrFolder, (f) => f.lists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folderId' })
  folder: HrFolder;

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
