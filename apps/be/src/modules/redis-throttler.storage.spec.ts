import { RedisThrottlerStorage } from './redis-throttler.storage';
import { RedisService } from '../services/redis.service';

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;

  afterEach(() => {
    storage?.onApplicationShutdown();
  });

  it('falls back to in-memory ThrottlerStorageService when Redis is disabled', async () => {
    const getReadyClient = jest.fn(() => Promise.resolve(null));
    const redisService = {
      isEnabled: jest.fn(() => false),
      getReadyClient,
    } as unknown as RedisService;

    storage = new RedisThrottlerStorage(redisService);

    const hit1 = await storage.increment('k1', 60_000, 2, 60_000, 'default');
    expect(hit1.totalHits).toBe(1);
    expect(hit1.isBlocked).toBe(false);

    const hit2 = await storage.increment('k1', 60_000, 2, 60_000, 'default');
    expect(hit2.totalHits).toBe(2);
    expect(hit2.isBlocked).toBe(false);

    const hit3 = await storage.increment('k1', 60_000, 2, 60_000, 'default');
    expect(hit3.totalHits).toBe(3);
    expect(hit3.isBlocked).toBe(true);
    expect(hit3.timeToBlockExpire).toBeGreaterThan(0);
    expect(getReadyClient).not.toHaveBeenCalled();
  });

  it('uses atomic Redis Lua script (INCR + PEXPIRE) when Redis is connected', async () => {
    const evalMock = jest
      .fn()
      .mockResolvedValueOnce([1, 59_400, 0, 0])
      .mockResolvedValueOnce([3, 58_100, 1, 58_100]);

    const redisService = {
      isEnabled: jest.fn(() => true),
      getReadyClient: jest.fn(() => Promise.resolve({ eval: evalMock })),
    } as unknown as RedisService;

    storage = new RedisThrottlerStorage(redisService);

    const r1 = await storage.increment('abc', 60_000, 2, 60_000, 'default');
    expect(evalMock).toHaveBeenCalledTimes(1);
    const firstCall = evalMock.mock.calls[0] as [
      string,
      number,
      string,
      string,
      number,
      number,
      number,
    ];
    const [script, numKeys, hitKey, blockKey, ttlArg, limitArg, blockArg] =
      firstCall;
    expect(script).toContain('INCR');
    expect(script).toContain('PEXPIRE');
    expect(numKeys).toBe(2);
    expect(hitKey).toBe('ocop:throttle:default:abc');
    expect(blockKey).toBe('ocop:throttle:block:default:abc');
    expect(ttlArg).toBe(60_000);
    expect(limitArg).toBe(2);
    expect(blockArg).toBe(60_000);
    expect(r1).toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });

    const r2 = await storage.increment('abc', 60_000, 2, 60_000, 'default');
    expect(r2).toEqual({
      totalHits: 3,
      timeToExpire: 59,
      isBlocked: true,
      timeToBlockExpire: 59,
    });
  });

  it('falls back cleanly to in-memory storage when Redis errors mid-request', async () => {
    const evalMock = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const redisService = {
      isEnabled: jest.fn(() => true),
      getReadyClient: jest.fn(() => Promise.resolve({ eval: evalMock })),
    } as unknown as RedisService;

    storage = new RedisThrottlerStorage(redisService);

    const r1 = await storage.increment(
      'fallback-key',
      60_000,
      1,
      60_000,
      'default',
    );
    expect(r1.totalHits).toBe(1);
    expect(r1.isBlocked).toBe(false);

    const r2 = await storage.increment(
      'fallback-key',
      60_000,
      1,
      60_000,
      'default',
    );
    expect(r2.totalHits).toBe(2);
    expect(r2.isBlocked).toBe(true);
  });

  it('falls back cleanly to in-memory storage when getReadyClient returns null', async () => {
    const redisService = {
      isEnabled: jest.fn(() => true),
      getReadyClient: jest.fn(() => Promise.resolve(null)),
    } as unknown as RedisService;

    storage = new RedisThrottlerStorage(redisService);

    const r1 = await storage.increment(
      'down-key',
      60_000,
      5,
      60_000,
      'default',
    );
    expect(r1.totalHits).toBe(1);
    expect(r1.isBlocked).toBe(false);
  });
});
