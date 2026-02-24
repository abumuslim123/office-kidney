import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('screens_photos')
export class ScreenPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  screenId: string;

  @Column({ type: 'varchar', length: 500 })
  imagePath: string;

  @Column({ type: 'int', default: 15 })
  durationSeconds: number;

  @Column({ type: 'int', default: 0 })
  rotation: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'int', default: 0 })
  orderIndex: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
