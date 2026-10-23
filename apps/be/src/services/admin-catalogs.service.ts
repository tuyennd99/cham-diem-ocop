import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminCatalogsRepository } from '../repositories/admin-catalogs.repository';
import type {
  AdminCategoriesQueryDto,
  CreateAdminCategoryDto,
  CreateProductGroupDto,
  ProductGroupsQueryDto,
  UpdateAdminCategoryDto,
  UpdateProductGroupDto,
} from '../dtos/admin-catalogs.dto';
import type { RequestMeta } from '../types/auth';

@Injectable()
export class AdminCatalogsService {
  constructor(private readonly repository: AdminCatalogsRepository) {}

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
