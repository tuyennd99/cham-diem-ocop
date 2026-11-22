import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: jest.Mocked<Pick<PrismaService, '$transaction'>>;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    service = new HealthService(prisma as unknown as PrismaService);
  });

  it('returns live status', () => {
    expect(service.live()).toEqual({ status: 'ok' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('checks the database inside a bounded transaction', async () => {
    const executeRaw = jest.fn((_sql: TemplateStringsArray) =>
      Promise.resolve(1),
    );
    const queryRaw = jest.fn((_sql: TemplateStringsArray) =>
      Promise.resolve([]),
    );
    prisma.$transaction.mockImplementationOnce((async (
      callback: (tx: unknown) => Promise<void>,
    ) => {
      await callback({
        $executeRaw: executeRaw,
        $queryRaw: queryRaw,
      });
      return undefined as never;
    }) as never);

    await expect(service.ready()).resolves.toEqual({ status: 'ok' });
    expect(executeRaw.mock.calls[0]?.[0]?.[0]).toContain(
      "SET LOCAL statement_timeout = '2000ms'",
    );
    expect(queryRaw.mock.calls[0]?.[0]?.[0]).toContain('SELECT 1');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 3000,
      maxWait: 1000,
    });
  });

  it('reports unavailable when the database check fails while keeping liveness independent', async () => {
    prisma.$transaction.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await expect(service.ready()).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      message: 'Database is unavailable',
    });
    expect(service.live()).toEqual({ status: 'ok' });
  });

  it('skips Redis check when REDIS_URL is not configured', async () => {
    const redis = {
      isEnabled: jest.fn(() => false),
      ping: jest.fn(),
    };
    const healthWithDisabledRedis = new HealthService(
      prisma as unknown as PrismaService,
      redis as never,
    );

    await expect(healthWithDisabledRedis.ready()).resolves.toEqual({
      status: 'ok',
    });
    expect(redis.isEnabled).toHaveBeenCalledTimes(1);
    expect(redis.ping).not.toHaveBeenCalled();
  });

  it('checks Redis PING when REDIS_URL is configured and succeeds', async () => {
    const redis = {
      isEnabled: jest.fn(() => true),
      ping: jest.fn().mockResolvedValue(true),
    };
    const healthWithRedis = new HealthService(
      prisma as unknown as PrismaService,
      redis as never,
    );

    await expect(healthWithRedis.ready()).resolves.toEqual({ status: 'ok' });
    expect(redis.ping).toHaveBeenCalledWith(1000);
  });

  it('throws ServiceUnavailableException when Redis PING fails while keeping liveness independent', async () => {
    const redis = {
      isEnabled: jest.fn(() => true),
      ping: jest.fn().mockResolvedValue(false),
    };
    const healthWithDownRedis = new HealthService(
      prisma as unknown as PrismaService,
      redis as never,
    );

    await expect(healthWithDownRedis.ready()).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      message: 'Redis is unavailable',
    });
    expect(healthWithDownRedis.live()).toEqual({ status: 'ok' });
  });
});
