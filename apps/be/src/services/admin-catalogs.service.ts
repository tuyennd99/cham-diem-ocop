import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { computePaginationSkip } from '../dtos/common.dto';
import { AdminCatalogsRepository } from '../repositories/admin-catalogs.repository';
import type {
  AdminLocalitiesQueryDto,
  AdminCategoriesQueryDto,
  CreateLocalityDto,
  CreateAdminCategoryDto,
  PublicLocalitiesQueryDto,
  UpdateLocalityDto,
  UpdateAdminCategoryDto,
} from '../dtos/admin-catalogs.dto';
import type { RequestMeta } from '../types/auth';
import {
  buildPublicLocalitiesCacheKey,
  CACHE_PREFIXES,
  invalidatePublicCachePrefixes,
  readThroughPublicCache,
} from '../utils/public-cache';
import { RedisService } from './redis.service';

@Injectable()
export class AdminCatalogsService {
  constructor(
    private readonly repository: AdminCatalogsRepository,
    @Optional() private readonly redis?: RedisService,
  ) {}

  listManagingAgencies() {
    return this.repository.listManagingAgencies();
  }

  async listAdminLocalities(query: AdminLocalitiesQueryDto) {
    return this.listLocalities(query, false);
  }

  async listPublicLocalities(query: PublicLocalitiesQueryDto) {
    computePaginationSkip(query.page ?? 1, query.limit ?? 20);
    const cacheKey = buildPublicLocalitiesCacheKey(query);
    return readThroughPublicCache(this.redis, cacheKey, () =>
      this.listLocalities(query, true),
    );
  }

  private async listLocalities(
    query: AdminLocalitiesQueryDto | PublicLocalitiesQueryDto,
    publicOnly: boolean,
  ) {
    const { data, total } = await this.repository.listLocalities(
      query,
      publicOnly,
    );
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async createLocality(
    input: CreateLocalityDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const locality = await this.repository.createLocality(input, actorId, meta);
    await invalidatePublicCachePrefixes(
      this.redis,
      CACHE_PREFIXES.LOCALITIES,
      CACHE_PREFIXES.PUBLIC_PRODUCTS,
    );
    return locality;
  }

  async updateLocality(
    id: string,
    input: UpdateLocalityDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const locality = await this.repository.updateLocality(
      id,
      input,
      actorId,
      meta,
    );
    if (!locality) throw new NotFoundException('Locality not found');
    await invalidatePublicCachePrefixes(
      this.redis,
      CACHE_PREFIXES.LOCALITIES,
      CACHE_PREFIXES.PUBLIC_PRODUCTS,
    );
    return locality;
  }

  async listCategories(query: AdminCategoriesQueryDto) {
    const { data, total } = await this.repository.listCategories(query);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getCategory(id: string) {
    const category = await this.repository.findCategory(id);
    if (!category) throw new NotFoundException('Product category not found');
    return category;
  }

  async createCategory(
    input: CreateAdminCategoryDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const category = await this.repository.createCategory(input, actorId, meta);
    if (!category) throw new NotFoundException('Product category not found');
    await invalidatePublicCachePrefixes(
      this.redis,
      CACHE_PREFIXES.CATEGORIES,
      CACHE_PREFIXES.PUBLIC_PRODUCTS,
    );
    return category;
  }

  async updateCategory(
    id: string,
    input: UpdateAdminCategoryDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const category = await this.repository.updateCategory(
      id,
      input,
      actorId,
      meta,
    );
    if (!category) throw new NotFoundException('Product category not found');
    await invalidatePublicCachePrefixes(
      this.redis,
      CACHE_PREFIXES.CATEGORIES,
      CACHE_PREFIXES.PUBLIC_PRODUCTS,
    );
    return category;
  }
}
