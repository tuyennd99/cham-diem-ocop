import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { getRedisUrl } from '../config/env';

const DEFAULT_TIMEOUT_MS = 1000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  // Prevent unhandled rejection if caller times out before promise settles.
  promise.catch(() => undefined);

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Redis operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Optional Redis client wrapper with lazy connection and graceful no-op/fallback
 * behavior when REDIS_URL is unset or Redis is temporarily unreachable.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor() {
    const redisUrl = getRedisUrl();
    if (!redisUrl) {
      this.client = null;
      return;
    }

    this.client = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: DEFAULT_TIMEOUT_MS,
    });
    this.client.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis connection error: ${message}`);
    });
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getClient(): Redis | null {
    return this.client;
  }

  async getReadyClient(): Promise<Redis | null> {
    if (!this.client) {
      return null;
    }
    if (this.client.status === 'ready') {
      return this.client;
    }
    if (this.client.status === 'wait') {
      try {
        await withTimeout(this.client.connect(), DEFAULT_TIMEOUT_MS);
        return (this.client.status as string) === 'ready' ? this.client : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client || this.client.status !== 'wait') {
      return;
    }
    try {
      await this.client.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Initial Redis connection failed; continuing with in-memory fallback: ${message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }
    const status = this.client.status;
    if (status === 'wait' || status === 'end') {
      this.client.disconnect();
      return;
    }
    try {
      await withTimeout(this.client.quit(), DEFAULT_TIMEOUT_MS);
    } catch {
      this.client.disconnect();
    }
  }

  async ping(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      if (this.client.status === 'wait') {
        await withTimeout(this.client.connect(), timeoutMs);
      }
      if (this.client.status !== 'ready' && this.client.status !== 'connect') {
        return false;
      }
      const reply = await withTimeout(this.client.ping(), timeoutMs);
      return reply === 'PONG';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis PING failed: ${message}`);
      return false;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const client = await this.getReadyClient();
    if (!client) {
      return null;
    }
    try {
      const raw = await client.get(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis getJson failed for key "${key}": ${message}`);
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    const client = await this.getReadyClient();
    if (!client) {
      return false;
    }
    try {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis setJson failed for key "${key}": ${message}`);
      return false;
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const client = await this.getReadyClient();
    if (!client) {
      return;
    }
    try {
      await client.del(...keys);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis del failed: ${message}`);
    }
  }

  async invalidatePrefix(prefix: string): Promise<void> {
    const client = await this.getReadyClient();
    if (!client) {
      return;
    }
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Redis invalidatePrefix failed for "${prefix}": ${message}`,
      );
    }
  }
}
