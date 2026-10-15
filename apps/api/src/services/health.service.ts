import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live() {
    return { status: 'ok' as const };
  }

  async ready() {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
        await tx.$queryRaw`SELECT 1`;
      }, { timeout: 3000, maxWait: 1000 });
    } catch {
      throw new ServiceUnavailableException('Database is unavailable');
    }
    return { status: 'ok' as const };
  }
}
