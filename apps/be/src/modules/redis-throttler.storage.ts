import { Logger, OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../services/redis.service';

const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local hitTtl = redis.call('PTTL', KEYS[1])
  if hitTtl < 0 then hitTtl = tonumber(ARGV[1]) end
  return { tonumber(ARGV[2]) + 1, hitTtl, 1, blockTtl }
end

local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
if pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  pttl = tonumber(ARGV[1])
end

local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
if current > limit then
  if blockDuration > 0 then
    redis.call('SET', KEYS[2], '1', 'PX', blockDuration)
    return { current, pttl, 1, blockDuration }
  end
  return { current, pttl, 1, pttl }
end

return { current, pttl, 0, 0 }
`;

/**
 * ThrottlerStorage backed by Redis atomic INCR + PEXPIRE with automatic fallback
 * to in-memory ThrottlerStorageService when Redis is disabled or unavailable.
 */
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.redisService.isEnabled()) {
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    try {
      const client = await this.redisService.getReadyClient();
      if (!client) {
        return this.fallback.increment(
          key,
          ttl,
          limit,
          blockDuration,
          throttlerName,
        );
      }

      const hitKey = `ocop:throttle:${throttlerName}:${key}`;
      const blockKey = `ocop:throttle:block:${throttlerName}:${key}`;
      const result = (await client.eval(
        INCREMENT_SCRIPT,
        2,
        hitKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      const totalHits = Number(result[0]);
      const pttlMs = Math.max(0, Number(result[1]));
      const isBlocked = Number(result[2]) === 1;
      const blockPttlMs = Math.max(0, Number(result[3]));

      return {
        totalHits,
        timeToExpire: Math.max(1, Math.ceil(pttlMs / 1000)),
        isBlocked,
        timeToBlockExpire: isBlocked
          ? Math.max(1, Math.ceil(blockPttlMs / 1000))
          : 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Redis throttler failed; falling back to memory: ${message}`,
      );
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }

  onApplicationShutdown(): void {
    this.fallback.onApplicationShutdown();
  }
}
