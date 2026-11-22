import { EventEmitter } from 'node:events';
import { RedisService } from './redis.service';

class MockRedisClient extends EventEmitter {
  status = 'ready';
  connect = jest.fn(() => {
    this.status = 'ready';
    return Promise.resolve();
  });
  ping = jest.fn(() => Promise.resolve('PONG'));
  get = jest.fn((_key: string): Promise<string | null> =>
    Promise.resolve(null),
  );
  set = jest.fn(() => Promise.resolve('OK'));
  del = jest.fn(() => Promise.resolve(1));
  scan = jest.fn(() => Promise.resolve(['0', []] as [string, string[]]));
  eval = jest.fn(() => Promise.resolve([1, 60000]));
  quit = jest.fn(() => {
    this.status = 'end';
    return Promise.resolve('OK');
  });
  disconnect = jest.fn(() => {
    this.status = 'end';
  });
}

const mockRedisConstructor = jest.fn<MockRedisClient, unknown[]>();

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn((...args: unknown[]) => mockRedisConstructor(...args)),
}));

describe('RedisService', () => {
  const originalRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  describe('when REDIS_URL is unset or empty', () => {
    it('runs in disabled no-op mode without constructing an ioredis client', async () => {
      process.env.REDIS_URL = '   ';
      const service = new RedisService();

      expect(mockRedisConstructor).not.toHaveBeenCalled();
      expect(service.isEnabled()).toBe(false);
      expect(service.getClient()).toBeNull();
      await expect(service.getReadyClient()).resolves.toBeNull();
      await expect(service.ping()).resolves.toBe(false);
      await expect(service.getJson('k')).resolves.toBeNull();
      await expect(service.setJson('k', { ok: true }, 60)).resolves.toBe(false);
      await expect(service.del('k')).resolves.toBeUndefined();
      await expect(
        service.invalidatePrefix('ocop:cache:v1:'),
      ).resolves.toBeUndefined();
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('when REDIS_URL is configured', () => {
    let mockClient: MockRedisClient;

    beforeEach(() => {
      mockClient = new MockRedisClient();
      mockRedisConstructor.mockReturnValue(mockClient);
      process.env.REDIS_URL = 'redis://127.0.0.1:6379/0';
    });

    it('configures ioredis with lazyConnect, maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 1000', () => {
      const service = new RedisService();

      expect(service.isEnabled()).toBe(true);
      expect(mockRedisConstructor).toHaveBeenCalledWith(
        'redis://127.0.0.1:6379/0',
        expect.objectContaining({
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 1000,
        }),
      );
      expect(service.getClient()).toBe(mockClient);
    });

    it('attaches an error listener so Redis error events do not crash the process', () => {
      new RedisService();
      expect(() =>
        mockClient.emit('error', new Error('ECONNREFUSED')),
      ).not.toThrow();
    });

    it('connects lazily via onModuleInit without throwing if Redis is down', async () => {
      mockClient.status = 'wait';
      mockClient.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const service = new RedisService();

      await expect(service.onModuleInit()).resolves.toBeUndefined();
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
    });

    it('pings successfully when connected and returns false on error or timeout', async () => {
      const service = new RedisService();

      await expect(service.ping(1000)).resolves.toBe(true);
      expect(mockClient.ping).toHaveBeenCalledTimes(1);

      mockClient.ping.mockRejectedValueOnce(new Error('Connection is closed'));
      await expect(service.ping(1000)).resolves.toBe(false);

      mockClient.ping.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve('PONG'), 200)),
      );
      await expect(service.ping(20)).resolves.toBe(false);
    });

    it('connects from wait status before pinging', async () => {
      mockClient.status = 'wait';
      const service = new RedisService();

      await expect(service.ping(1000)).resolves.toBe(true);
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.ping).toHaveBeenCalledTimes(1);
    });

    it('returns null from getReadyClient immediately when client is reconnecting/closed', async () => {
      mockClient.status = 'reconnecting';
      const service = new RedisService();

      await expect(service.getReadyClient()).resolves.toBeNull();
      expect(mockClient.connect).not.toHaveBeenCalled();
    });

    it('reads/writes JSON and falls back cleanly on Redis errors or invalid JSON', async () => {
      const service = new RedisService();

      await expect(service.setJson('ocop:test', { a: 1 }, 60)).resolves.toBe(
        true,
      );
      expect(mockClient.set).toHaveBeenCalledWith(
        'ocop:test',
        JSON.stringify({ a: 1 }),
        'EX',
        60,
      );

      mockClient.get.mockResolvedValueOnce('{"a":1}');
      await expect(
        service.getJson<{ a: number }>('ocop:test'),
      ).resolves.toEqual({
        a: 1,
      });

      mockClient.get.mockResolvedValueOnce('not-json');
      await expect(service.getJson('ocop:test')).resolves.toBeNull();

      mockClient.get.mockRejectedValueOnce(new Error('READONLY'));
      await expect(service.getJson('ocop:test')).resolves.toBeNull();

      mockClient.set.mockRejectedValueOnce(new Error('OOM'));
      await expect(service.setJson('ocop:test', { a: 2 }, 60)).resolves.toBe(
        false,
      );
    });

    it('invalidates keys by prefix using SCAN and DEL without KEYS', async () => {
      const service = new RedisService();
      mockClient.scan
        .mockResolvedValueOnce(['12', ['ocop:cache:v1:a', 'ocop:cache:v1:b']])
        .mockResolvedValueOnce(['0', ['ocop:cache:v1:c']]);

      await service.invalidatePrefix('ocop:cache:v1:');

      expect(mockClient.scan).toHaveBeenNthCalledWith(
        1,
        '0',
        'MATCH',
        'ocop:cache:v1:*',
        'COUNT',
        100,
      );
      expect(mockClient.scan).toHaveBeenNthCalledWith(
        2,
        '12',
        'MATCH',
        'ocop:cache:v1:*',
        'COUNT',
        100,
      );
      expect(mockClient.del).toHaveBeenNthCalledWith(
        1,
        'ocop:cache:v1:a',
        'ocop:cache:v1:b',
      );
      expect(mockClient.del).toHaveBeenNthCalledWith(2, 'ocop:cache:v1:c');
    });

    it('gracefully closes on OnModuleDestroy via disconnect when wait and quit when active', async () => {
      mockClient.status = 'wait';
      const lazyService = new RedisService();
      await lazyService.onModuleDestroy();
      expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
      expect(mockClient.quit).not.toHaveBeenCalled();

      const activeClient = new MockRedisClient();
      activeClient.status = 'ready';
      mockRedisConstructor.mockReturnValueOnce(activeClient);
      const activeService = new RedisService();
      await activeService.onModuleDestroy();
      expect(activeClient.quit).toHaveBeenCalledTimes(1);
    });
  });
});
