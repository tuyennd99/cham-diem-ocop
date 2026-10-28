import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class AdminCatalogsService {
  constructor(private readonly repository: AdminCatalogsRepository) {}

  async listAdminLocalities(query: AdminLocalitiesQueryDto) {
    return this.listLocalities(query, false);
  }

  async listPublicLocalities(query: PublicLocalitiesQueryDto) {
    return this.listLocalities(query, true);
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

  createLocality(input: CreateLocalityDto, actorId: string, meta: RequestMeta) {
    return this.repository.createLocality(input, actorId, meta);
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
    if (!category)
      throw new NotFoundException('Product category not found');
    return category;
  }
}
