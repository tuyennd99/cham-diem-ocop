import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReportKind } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { RejectReportDto, SaveReportDraftDto } from '../dtos/reports.dto';
import { FilesService } from '../services/files.service';
import { ReportsService } from '../services/reports.service';
import type { AccessTokenPayload } from '../types/auth';
import type { UploadedPrivateFile } from '../types/files';
import { asDownload, privateUploadOptions } from '../utils/private-storage';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Consolidated reports')
@ApiBearerAuth()
@Controller('consolidated-reports')
export class ConsolidatedReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly files: FilesService,
  ) { }

  @Get('periods/:periodId')
  @Permissions('consolidated.edit')
  open(
    @Param('periodId', ParseIntPipe) periodId: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reports.openConsolidated(periodId, principal);
  }

  @Get(':id')
  @Permissions('tasks.read')
  get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reports.get(id, ReportKind.CONSOLIDATED, principal);
  }

  @Patch(':id')
  @Permissions('consolidated.edit')
  @ResponseMessage('Lưu báo cáo tổng hợp thành công')
  save(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SaveReportDraftDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.saveDraft(
      id,
      ReportKind.CONSOLIDATED,
      body.content,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/submit')
  @Permissions('consolidated.submit')
  @ResponseMessage('Gửi báo cáo tổng hợp thành công')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.submit(
      id,
      ReportKind.CONSOLIDATED,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/approve')
  @Permissions('consolidated.review')
  @ResponseMessage('Phê duyệt báo cáo tổng hợp thành công')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.approve(
      id,
      ReportKind.CONSOLIDATED,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/reject')
  @Permissions('consolidated.review')
  @ResponseMessage('Từ chối báo cáo tổng hợp thành công')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectReportDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.reject(
      id,
      ReportKind.CONSOLIDATED,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/return')
  @Permissions('consolidated.review')
  @ResponseMessage('Trả lại báo cáo tổng hợp thành công')
  returnReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectReportDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.returnApproved(
      id,
      ReportKind.CONSOLIDATED,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/files')
  @Permissions('consolidated.edit')
  @ResponseMessage('Tải tệp lên thành công')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', privateUploadOptions()))
  upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: UploadedPrivateFile | undefined,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.files.uploadDraftFile(
      id,
      file,
      principal,
      requestMeta(request),
    );
  }

  @Delete(':id/files/:fileId')
  @Permissions('consolidated.edit')
  @ResponseMessage('Xóa tệp thành công')
  removeFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.files.removeDraftFile(
      id,
      fileId,
      principal,
      requestMeta(request),
    );
  }

  @Get(':id/files/:fileId/download')
  @Permissions('tasks.read')
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return asDownload(
      await this.files.downloadWorkspaceFile(
        id,
        fileId,
        principal,
        requestMeta(request),
      ),
    );
  }
}
