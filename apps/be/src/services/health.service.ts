import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from './redis.service';

const REDIS_PING_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  live() {
    return { status: 'ok' as const };
  }

  async ready() {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
          await tx.$queryRaw`SELECT 1`;
        },
        { timeout: 3000, maxWait: 1000 },
      );
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }

    if (this.redis?.isEnabled()) {
      const ok = await this.redis.ping(REDIS_PING_TIMEOUT_MS);
      if (!ok) {
        throw new ServiceUnavailableException('Redis is unavailable');
      }
    }

    return { status: 'ok' as const };
  }
}
