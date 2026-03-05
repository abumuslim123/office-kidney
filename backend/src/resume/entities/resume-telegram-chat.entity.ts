import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('resume_telegram_chats')
export class ResumeTelegramChat {
  @PrimaryColumn({ type: 'bigint' })
  chatId: string;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  authorizedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'varchar', nullable: true })
  firstName: string | null;
}
