import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { StaffPermission } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import {
  AdminProductCreateDto,
  AdminProductUpdateDto,
  ProductMutationReasonDto,
} from '../dtos/admin-products.dto';
import { ProductsService } from '../services/products.service';
import type { AuthenticatedPrincipal } from '../types/auth';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Admin products')
@ApiBearerAuth()
@Permissions(StaffPermission.MANAGE)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  create(
    @Body() body: AdminProductCreateDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.products.createForAdmin(body, principal, requestMeta(request));
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: AdminProductUpdateDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.products.updateForAdmin(
      id,
      body,
      principal,
      requestMeta(request),
    );
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Body() body: ProductMutationReasonDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.products.removeForAdmin(
      id,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @Body() body: ProductMutationReasonDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.products.submitForAdmin(
      id,
      body.reason,
      principal,
      requestMeta(request),
    );
  }
}
