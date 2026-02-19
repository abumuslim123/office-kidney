import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { UserPushSubscription } from './entities/user-push-subscription.entity';

type PushPayload = {
  title: string;
  body: string;
  url: string;
  processId: string;
  version: number;
};

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private readonly isConfigured: boolean;

  constructor(
    @InjectRepository(UserPushSubscription)
    private subscriptionsRepo: Repository<UserPushSubscription>,
  ) {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    this.isConfigured = !!publicKey && !!privateKey && !!subject;
    if (this.isConfigured) {
      webpush.setVapidDetails(subject as string, publicKey as string, privateKey as string);
    } else {
      this.logger.warn(
        'Web push is disabled. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.',
      );
    }
  }

  getPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || '';
  }

  async upsertSubscription(params: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string | null;
  }): Promise<void> {
    const existing = await this.subscriptionsRepo.findOne({
      where: { endpoint: params.endpoint },
    });
    if (existing) {
      existing.userId = params.userId;
      existing.p256dh = params.p256dh;
      existing.auth = params.auth;
      existing.userAgent = params.userAgent ?? null;
      await this.subscriptionsRepo.save(existing);
      return;
    }
    await this.subscriptionsRepo.save(
      this.subscriptionsRepo.create({
        userId: params.userId,
        endpoint: params.endpoint,
        p256dh: params.p256dh,
        auth: params.auth,
        userAgent: params.userAgent ?? null,
      }),
    );
  }

  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await this.subscriptionsRepo.delete({ userId, endpoint });
  }

  async getSubscriptionsForUsers(userIds: string[]): Promise<UserPushSubscription[]> {
    if (!userIds.length) return [];
    return this.subscriptionsRepo
      .createQueryBuilder('s')
      .where('s.userId IN (:...userIds)', { userIds })
      .getMany();
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.isConfigured || !userIds.length) return;
    const subscriptions = await this.getSubscriptionsForUsers(userIds);
    this.logger.log(
      `Process push: recipients=${userIds.length}, subscriptions=${subscriptions.length}, processId=${payload.processId}, version=${payload.version}`,
    );
    if (!subscriptions.length) return;
    const body = JSON.stringify(payload);
    let deliveredCount = 0;
    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            body,
          );
          deliveredCount += 1;
        } catch (error: unknown) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.subscriptionsRepo.delete({ id: sub.id });
            return;
          }
          this.logger.warn(
            `Push send failed for subscription ${sub.id}: ${
              (error as Error)?.message || 'unknown error'
            }`,
          );
        }
      }),
    );
    this.logger.log(
      `Process push delivered=${deliveredCount}/${subscriptions.length}, processId=${payload.processId}, version=${payload.version}`,
    );
  }
}
