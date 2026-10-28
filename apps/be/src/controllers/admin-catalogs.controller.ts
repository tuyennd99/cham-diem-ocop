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
  AdminLocalitiesQueryDto,
  AdminCategoriesQueryDto,
  CreateLocalityDto,
  CreateAdminCategoryDto,
  UpdateLocalityDto,
  UpdateAdminCategoryDto,
} from '../dtos/admin-catalogs.dto';
import { AdminCatalogsService } from '../services/admin-catalogs.service';
import type { AccessTokenPayload } from '../types/auth';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Admin catalogs')
@ApiBearerAuth()
@ApiExtraModels(
  AdminCategoriesQueryDto,
  AdminLocalitiesQueryDto,
)
@Controller('admin')
export class AdminCatalogsController {
  constructor(private readonly catalogs: AdminCatalogsService) {}

  @Get('localities')
  @Permissions(StaffPermission.VIEW)
  listLocalities(@Query() query: AdminLocalitiesQueryDto) {
    return this.catalogs.listAdminLocalities(query);
  }

  @Post('localities')
  @Permissions(StaffPermission.MANAGE)
  createLocality(
    @Body() body: CreateLocalityDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.catalogs.createLocality(
      body,
      principal.sub,
      requestMeta(request),
    );
  }

  @Put('localities/:id')
  @Permissions(StaffPermission.MANAGE)
  updateLocality(
    @Param('id') id: string,
    @Body() body: UpdateLocalityDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.catalogs.updateLocality(
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
