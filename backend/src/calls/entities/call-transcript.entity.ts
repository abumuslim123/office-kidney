import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('call_transcripts')
export class CallTranscript {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  callId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'text', nullable: true })
  operatorText: string | null;

  @Column({ type: 'text', nullable: true })
  abonentText: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  language: string | null;

  @Column({ type: 'varchar', length: 50, default: 'polza' })
  provider: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
