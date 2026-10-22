import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: jest.Mocked<Pick<PrismaService, '$transaction'>>;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Pick<PrismaService, '$transaction'>>;
    service = new HealthService(prisma as unknown as PrismaService);
  });

  it('returns live status', () => {
    expect(service.live()).toEqual({ status: 'ok' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('checks the database inside a bounded transaction', async () => {
    const executeRaw = jest.fn();
    const queryRaw = jest.fn();
    prisma.$transaction.mockImplementationOnce(async (callback: never) => {
      await (callback as unknown as (tx: unknown) => Promise<void>)({
        $executeRaw: executeRaw,
        $queryRaw: queryRaw,
      });
      return undefined as never;
    });

    await expect(service.ready()).resolves.toEqual({ status: 'ok' });
    expect(executeRaw.mock.calls[0][0][0]).toContain("SET LOCAL statement_timeout = '2000ms'");
    expect(queryRaw.mock.calls[0][0][0]).toContain('SELECT 1');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 3000, maxWait: 1000 });
  });

  it('reports unavailable when the database check fails while keeping liveness independent', async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.ready()).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      message: 'Database is unavailable',
    });
    expect(service.live()).toEqual({ status: 'ok' });
  });
});
