import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('call_speakers')
export class CallSpeaker {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  tritechModelId: string | null;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string; // 'pending' | 'training' | 'ready' | 'error'

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
