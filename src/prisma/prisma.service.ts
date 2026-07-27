import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createPrismaAdapter, PrismaClient } from './client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: createPrismaAdapter() });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
