import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';

const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of store) {
    if (now > record.resetAt) {
      store.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function createRateLimitGuard(maxRequests: number, windowMs: number) {
  @Injectable()
  class RateLimitGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest();
      const ip = request.ip || request.connection?.remoteAddress || 'unknown';
      const key = `resume:${request.path}:${ip}`;
      const now = Date.now();
      const record = store.get(key);

      if (!record || now > record.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }

      if (record.count >= maxRequests) {
        throw new HttpException(
          { message: 'Слишком много запросов. Попробуйте позже.', retryAfter: Math.ceil((record.resetAt - now) / 1000) },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      record.count++;
      return true;
    }
  }
  return RateLimitGuard;
}

export const UploadRateLimitGuard = createRateLimitGuard(5, 60 * 60 * 1000); // 5 per hour
export const SubmitRateLimitGuard = createRateLimitGuard(3, 60 * 60 * 1000); // 3 per hour
