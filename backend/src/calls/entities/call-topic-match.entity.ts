import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('call_topic_matches')
export class CallTopicMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  callId: string;

  @Column({ type: 'uuid' })
  topicId: string;

  @Column({ type: 'varchar', length: 200 })
  keyword: string;

  @Column({ type: 'int', default: 1 })
  occurrences: number;

  @CreateDateColumn()
  createdAt: Date;
}
