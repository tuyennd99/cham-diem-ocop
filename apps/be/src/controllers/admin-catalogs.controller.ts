import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { StaffPermission } from '@prisma/client';
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import {
  AdminCategoriesQueryDto,
  CreateAdminCategoryDto,
  CreateProductGroupDto,
  ProductGroupsQueryDto,
  UpdateAdminCategoryDto,
  UpdateProductGroupDto,
} from '../dtos/admin-catalogs.dto';
import { AdminCatalogsService } from '../services/admin-catalogs.service';
import type { AccessTokenPayload } from '../types/auth';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Admin catalogs')
@ApiBearerAuth()
@ApiExtraModels(ProductGroupsQueryDto, AdminCategoriesQueryDto)
@Controller('admin')
export class AdminCatalogsController {
  constructor(private readonly catalogs: AdminCatalogsService) {}

  @Get('product-groups')
  @Permissions(StaffPermission.VIEW)
  listProductGroups(@Query() query: ProductGroupsQueryDto) {
    return this.catalogs.listProductGroups(query);
  }

  @Post('product-groups')
  @Permissions(StaffPermission.MANAGE)
  createProductGroup(
    @Body() body: CreateProductGroupDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.catalogs.createProductGroup(
      body,
      principal.sub,
      requestMeta(request),
    );
  }

  @Put('product-groups/:id')
  @Permissions(StaffPermission.MANAGE)
  updateProductGroup(
    @Param('id') id: string,
    @Body() body: UpdateProductGroupDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.catalogs.updateProductGroup(
      id,
      body,
      principal.sub,
      requestMeta(request),
    );
  }

  @Get('categories')
  @Permissions(StaffPermission.VIEW)
  listCategories(@Query() query: AdminCategoriesQueryDto) {
    return this.catalogs.listCategories(query);
  }

  @Get('categories/:id')
  @Permissions(StaffPermission.VIEW)
  getCategory(@Param('id') id: string) {
    return this.catalogs.getCategory(id);
  }

  @Post('categories')
  @Permissions(StaffPermission.MANAGE)
  createCategory(
    @Body() body: CreateAdminCategoryDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.catalogs.createCategory(
      body,
      principal.sub,
      requestMeta(request),
    );
  }

  @Put('categories/:id')
  @Permissions(StaffPermission.MANAGE)
  updateCategory(
    @Param('id') id: string,
    @Body() body: UpdateAdminCategoryDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.catalogs.updateCategory(
      id,
      body,
      principal.sub,
      requestMeta(request),
    );
  }
}
