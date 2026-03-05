import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  employeeName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  clientName: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  clientPhone: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  callAt: Date;

  @Column({ type: 'int', default: 0 })
  durationSeconds: number;

  @Column({ type: 'int', default: 0 })
  speechDurationSeconds: number;

  @Column({ type: 'int', default: 0 })
  silenceDurationSeconds: number;

  @Column({ type: 'varchar', length: 500 })
  audioPath: string;

  @Column({ type: 'varchar', length: 30, default: 'uploaded' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
