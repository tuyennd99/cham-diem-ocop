import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReportKind } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import {
  OpenProgressQueryDto,
  RejectReportDto,
  SaveReportDraftDto,
} from '../dtos/reports.dto';
import { FilesService } from '../services/files.service';
import { ReportsService } from '../services/reports.service';
import type { AccessTokenPayload } from '../types/auth';
import type { UploadedPrivateFile } from '../types/files';
import { asDownload, privateUploadOptions } from '../utils/private-storage';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Progress reports')
@ApiBearerAuth()
@Controller('progress-reports')
export class ProgressReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly files: FilesService,
  ) { }

  @Get('periods/:periodId')
  open(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Query() query: OpenProgressQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reports.openProgress(
      periodId,
      principal,
      query.ownerOrganizationId,
    );
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reports.get(id, ReportKind.PROGRESS, principal);
  }

  @Patch(':id')
  @ResponseMessage('Lưu báo cáo thành công')
  save(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: SaveReportDraftDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.saveDraft(
      id,
      ReportKind.PROGRESS,
      body.content,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/submit')
  @ResponseMessage('Gửi báo cáo thành công')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.submit(
      id,
      ReportKind.PROGRESS,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/approve')
  @ResponseMessage('Phê duyệt báo cáo thành công')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.approve(
      id,
      ReportKind.PROGRESS,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/reject')
  @ResponseMessage('Từ chối báo cáo thành công')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectReportDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.reject(
      id,
      ReportKind.PROGRESS,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/return')
  @ResponseMessage('Trả lại báo cáo thành công')
  returnReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectReportDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reports.returnApproved(
      id,
      ReportKind.PROGRESS,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/files')
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
