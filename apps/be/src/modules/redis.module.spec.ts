import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getStorageToken } from '@nestjs/throttler';
import appModules from './index';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { UserThrottlerGuard } from '../guards/user-throttler.guard';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from '../services/health.service';
import { RedisService } from '../services/redis.service';

@Module({
  imports: appModules,
  providers: [
    {
      provide: PrismaService,
      useValue: {
        $transaction: jest.fn().mockResolvedValue(undefined),
      },
    },
    HealthService,
    UserThrottlerGuard,
  ],
})
class TestWiringModule {}

describe('RedisModule and ThrottlerModule NestJS wiring', () => {
  const originalEnv = {
    REDIS_URL: process.env.REDIS_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
  };

  beforeEach(() => {
    delete process.env.REDIS_URL;
    process.env.JWT_SECRET = '0123456789abcdef0123456789abcdef';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASSWORD = 'secret';
    process.env.SMTP_FROM = 'OCOP <noreply@example.com>';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('resolves RedisService, RedisThrottlerStorage, HealthService, and UserThrottlerGuard cleanly without REDIS_URL', async () => {
    const app = await NestFactory.createApplicationContext(TestWiringModule, {
      logger: false,
    });

    try {
      const redis = app.get(RedisService);
      const storage = app.get<unknown>(getStorageToken());
      const health = app.get(HealthService);
      const guard = app.get(UserThrottlerGuard);

      expect(redis).toBeInstanceOf(RedisService);
      expect(redis.isEnabled()).toBe(false);
      expect(storage).toBeInstanceOf(RedisThrottlerStorage);
      expect(guard).toBeInstanceOf(UserThrottlerGuard);
      await expect(health.ready()).resolves.toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });
});
