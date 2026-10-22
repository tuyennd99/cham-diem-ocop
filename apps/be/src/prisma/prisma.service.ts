import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPrismaAdapter } from './client';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: createPrismaAdapter() });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
