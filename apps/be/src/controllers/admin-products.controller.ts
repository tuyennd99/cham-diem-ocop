import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { StaffPermission } from '@prisma/client';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import {
  AdminProductCreateDto,
  AdminProductQueryDto,
  AdminProductUpdateDto,
  ProductMutationReasonDto,
} from '../dtos/admin-products.dto';
import { AdminService } from '../services/admin.service';
import { ProductsService } from '../services/products.service';
import type { AuthenticatedPrincipal } from '../types/auth';
import type { UploadedPrivateFile } from '../types/files';
import { asDownload, productUploadOptions } from '../utils/private-storage';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Admin products')
@ApiBearerAuth()
@Permissions(StaffPermission.MANAGE)
@Controller('admin/products')
export class AdminProductsController {
  constructor(
    private readonly admin: AdminService,
    private readonly products: ProductsService,
  ) {}

  @Get()
  @Permissions(StaffPermission.VIEW)
  list(
    @Query() query: AdminProductQueryDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.listProducts(
      query,
      principal.staffPermissions.includes(StaffPermission.MANAGE),
    );
  }

  @Get(':id')
  @Permissions(StaffPermission.VIEW)
  detail(
    @Param('id') id: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.productDetail(
      id,
      principal.staffPermissions.includes(StaffPermission.MANAGE),
    );
  }

  @Get(':id/results')
  @Permissions(StaffPermission.VIEW)
  results(
    @Param('id') id: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.productResults(
      id,
      principal.staffPermissions.includes(StaffPermission.MANAGE),
    );
  }

  @Get(':id/attachments')
  @Permissions(StaffPermission.VIEW)
  attachments(
    @Param('id') id: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.productAttachments(
      id,
      principal.staffPermissions.includes(StaffPermission.MANAGE),
    );
  }

  @Get(':id/attachments/:attachmentId')
  @Permissions(StaffPermission.VIEW)
  async attachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ): Promise<StreamableFile> {
    return asDownload(
      await this.products.getAdminAttachment(id, attachmentId, principal),
    );
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'reason'],
      properties: {
        file: { type: 'string', format: 'binary' },
        reason: { type: 'string', maxLength: 255 },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', productUploadOptions()))
  upload(
    @Param('id') id: string,
    @Body() body: ProductMutationReasonDto,
    @UploadedFile() file: UploadedPrivateFile | undefined,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.products.addAdminAttachment(
      id,
      file,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Body() body: ProductMutationReasonDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.products.removeAdminAttachment(
      id,
      attachmentId,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

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
