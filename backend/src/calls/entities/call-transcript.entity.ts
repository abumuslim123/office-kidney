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

  @Column({ type: 'jsonb', nullable: true })
  turns: { speaker: 'operator' | 'abonent' | 'speaker-a' | 'speaker-b'; text: string; start?: number; end?: number }[] | null;

  @Column({ type: 'jsonb', nullable: true })
  words: { word: string; start: number; end: number; speaker: 'operator' | 'abonent' }[] | null;

  @Column({ type: 'jsonb', nullable: true })
  sentiment: {
    operator: string | null;
    abonent: string | null;
    perTurn: { speaker: string; sentiment: string; confidence?: number }[] | null;
  } | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  language: string | null;

  @Column({ type: 'jsonb', nullable: true })
  dictionaryApplied: { original: string; corrected: string; count: number }[] | null;

  @Column({ type: 'varchar', length: 50, default: 'polza' })
  provider: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
