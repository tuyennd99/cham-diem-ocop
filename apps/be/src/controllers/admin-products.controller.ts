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
import { ResponseMessage } from '../decorators/response-message.decorator';
import {
  AddProductJudgeAssignmentDto,
  AdminProductCreateDto,
  AdminProductQueryDto,
  AdminProductUpdateDto,
  ApproveProductDto,
  ProductMutationReasonDto,
  PublishProductResultsDto,
  RemoveProductJudgeAssignmentDto,
  ReopenEvaluationDto,
  ReopenProductDto,
  ReturnProductDto,
} from '../dtos/admin-products.dto';
import { AdminService } from '../services/admin.service';
import { ProductsService } from '../services/products.service';
import { CleanupRejectedUploadInterceptor } from '../interceptors/cleanup-rejected-upload.interceptor';
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

  @Get(':id/registration-print-data')
  @Permissions(StaffPermission.VIEW)
  registrationPrintData(
    @Param('id') id: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.productRegistrationPrintData(id, principal);
  }

  @Get(':id/results/print-data')
  @Permissions(StaffPermission.VIEW)
  resultsPrintData(
    @Param('id') id: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.productResultsPrintData(id, principal);
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

  @Post(':id/approve')
  @Permissions(StaffPermission.VIEW)
  @ResponseMessage('Duyệt hồ sơ sản phẩm thành công')
  approve(
    @Param('id') id: string,
    @Body() body: ApproveProductDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.admin.approveProduct(id, body, principal, requestMeta(request));
  }

  @Post(':id/return')
  @Permissions(StaffPermission.VIEW)
  @ResponseMessage('Trả lại hồ sơ sản phẩm thành công')
  returnProduct(
    @Param('id') id: string,
    @Body() body: ReturnProductDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.admin.returnProduct(id, body, principal, requestMeta(request));
  }

  @Post(':id/publish-results')
  @Permissions(StaffPermission.VIEW)
  @ResponseMessage('Công bố kết quả chấm điểm thành công')
  publishResults(
    @Param('id') id: string,
    @Body() body: PublishProductResultsDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.admin.publishProductResults(
      id,
      body,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/reopen')
  @Permissions(StaffPermission.VIEW)
  @ResponseMessage('Mở lại hồ sơ sản phẩm thành công')
  reopen(
    @Param('id') id: string,
    @Body() body: ReopenProductDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.admin.reopenProduct(id, body, principal, requestMeta(request));
  }

  @Get(':id/eligible-judges')
  @Permissions(StaffPermission.VIEW)
  eligibleJudges(@Param('id') id: string) {
    return this.admin.listEligibleJudgesForProduct(id);
  }

  @Post(':id/assignments')
  @Permissions(StaffPermission.VIEW)
  @ResponseMessage('Cập nhật phân công giám khảo thành công')
  addAssignment(
    @Param('id') id: string,
    @Body() body: AddProductJudgeAssignmentDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.admin.addProductJudgeAssignment(
      id,
      body,
      principal,
      requestMeta(request),
    );
  }

  @Delete(':id/assignments/:judgeId')
  @Permissions(StaffPermission.VIEW)
  @ResponseMessage('Gỡ giám khảo khỏi hồ sơ thành công')
  removeAssignment(
    @Param('id') id: string,
    @Param('judgeId') judgeId: string,
    @Body() body: RemoveProductJudgeAssignmentDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.admin.removeProductJudgeAssignment(
      id,
      judgeId,
      body,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/evaluations/:evaluationId/reopen')
  @Permissions(StaffPermission.VIEW)
  @ResponseMessage('Mở lại phiếu chấm điểm thành công')
  reopenEvaluation(
    @Param('id') id: string,
    @Param('evaluationId') evaluationId: string,
    @Body() body: ReopenEvaluationDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ) {
    return this.admin.reopenEvaluation(
      id,
      evaluationId,
      body,
      principal,
      requestMeta(request),
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
  @UseInterceptors(
    CleanupRejectedUploadInterceptor,
    FileInterceptor('file', productUploadOptions()),
  )
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
