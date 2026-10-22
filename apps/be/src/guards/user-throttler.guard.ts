import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(request: Record<string, unknown>): Promise<string> {
    const userId = (request.user as { sub?: unknown } | undefined)?.sub;
    if (typeof userId === 'string' && userId.length > 0) {
      return Promise.resolve(`user:${userId}`);
    }
    return Promise.resolve(
      `ip:${typeof request.ip === 'string' ? request.ip : 'unknown'}`,
    );
  }
}
