import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminCatalogsRepository } from '../repositories/admin-catalogs.repository';
import type {
  AdminLocalitiesQueryDto,
  AdminCategoriesQueryDto,
  CreateLocalityDto,
  CreateAdminCategoryDto,
  CreateProductGroupDto,
  ProductGroupsQueryDto,
  PublicLocalitiesQueryDto,
  UpdateLocalityDto,
  UpdateAdminCategoryDto,
  UpdateProductGroupDto,
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

  async listProductGroups(query: ProductGroupsQueryDto) {
    const { data, total } = await this.repository.listProductGroups(query);
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

  createProductGroup(
    input: CreateProductGroupDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    return this.repository.createProductGroup(input, actorId, meta);
  }

  async updateProductGroup(
    id: string,
    input: UpdateProductGroupDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const group = await this.repository.updateProductGroup(
      id,
      input,
      actorId,
      meta,
    );
    if (!group) throw new NotFoundException('Product group not found');
    return group;
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
    if (!category) throw new NotFoundException('Product group not found');
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
      throw new NotFoundException('Product category or group not found');
    return category;
  }
}
