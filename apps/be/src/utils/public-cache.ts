import { Logger } from '@nestjs/common';
import { SORT_DIRECTION } from '../constants/products';
import type { RedisService } from '../services/redis.service';

const logger = new Logger('PublicCache');

export const PUBLIC_CACHE_TTL_SECONDS = 60;

export const CACHE_KEYS = {
  CATEGORIES: 'ocop:cache:v1:categories',
} as const;

export const CACHE_PREFIXES = {
  CATEGORIES: 'ocop:cache:v1:categories',
  LOCALITIES: 'ocop:cache:v1:localities',
  PUBLIC_PRODUCTS: 'ocop:cache:v1:public-products:',
} as const;

export function buildPublicProductsListCacheKey(input: {
  page: number;
  limit: number;
  categoryId?: string;
  query?: string;
  approvedOnly?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set('approvedOnly', String(Boolean(input.approvedOnly)));
  if (input.categoryId) params.set('categoryId', input.categoryId);
  params.set('limit', String(input.limit));
  params.set('page', String(input.page));
  if (input.query) params.set('query', input.query);
  return `${CACHE_PREFIXES.PUBLIC_PRODUCTS}list:${params.toString()}`;
}

export function buildPublicProductDetailCacheKey(id: string): string {
  return `${CACHE_PREFIXES.PUBLIC_PRODUCTS}detail:${encodeURIComponent(id)}`;
}

export function buildPublicLocalitiesCacheKey(query: {
  page?: number;
  limit?: number;
  q?: string;
  provinceName?: string;
  sortBy?: string;
  sortDirection?: string;
}): string {
  const params = new URLSearchParams();
  params.set('limit', String(query.limit ?? 20));
  params.set('page', String(query.page ?? 1));
  if (query.provinceName) params.set('provinceName', query.provinceName);
  if (query.q) params.set('q', query.q);
  if (query.sortBy) {
    params.set('sortBy', query.sortBy);
    params.set('sortDirection', query.sortDirection ?? SORT_DIRECTION.ASC);
  }
  return `${CACHE_PREFIXES.LOCALITIES}:${params.toString()}`;
}

/**
 * Reads from Redis when enabled and falls back to PostgreSQL transparently on
 * cache miss, disabled Redis, or unexpected Redis errors.
 */
export async function readThroughPublicCache<T>(
  redis: RedisService | undefined,
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = PUBLIC_CACHE_TTL_SECONDS,
): Promise<T> {
  if (redis?.isEnabled()) {
    try {
      const cached = await redis.getJson<T>(key);
      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Public cache read failed for "${key}": ${message}`);
    }
  }

  const fresh = await loader();

  if (redis?.isEnabled()) {
    try {
      await redis.setJson(key, fresh, ttlSeconds);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Public cache write failed for "${key}": ${message}`);
    }
  }

  return fresh;
}

/**
 * Invalidates all keys matching the given cache prefixes without letting Redis
 * failures abort database mutations.
 */
export async function invalidatePublicCachePrefixes(
  redis: RedisService | undefined,
  ...prefixes: string[]
): Promise<void> {
  if (!redis?.isEnabled() || prefixes.length === 0) {
    return;
  }
  await Promise.all(
    prefixes.map(async (prefix) => {
      try {
        await redis.invalidatePrefix(prefix);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          `Public cache invalidation failed for "${prefix}": ${message}`,
        );
      }
    }),
  );
}
