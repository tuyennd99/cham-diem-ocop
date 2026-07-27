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
import { ReportKind } from '../prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { RejectReportDto, SaveReportDraftDto } from '../dtos/reports.dto';
import { FilesService, UploadedPrivateFile } from '../services/files.service';
import { ReportsService } from '../services/reports.service';
import type { AccessTokenPayload } from '../types/auth';
import { asDownload, privateUploadOptions } from '../utils/private-storage';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Progress reports')
@ApiBearerAuth()
@Controller('progress-reports')
export class ProgressReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly files: FilesService,
  ) {}

  @Get('periods/:periodId')
  @Permissions('progress.edit')
  open(
    @Param('periodId', ParseIntPipe) periodId: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reports.openProgress(periodId, principal);
  }

  @Get(':id')
  @Permissions('tasks.read')
  get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reports.get(id, ReportKind.PROGRESS, principal);
  }

  @Patch(':id')
  @Permissions('progress.edit')
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
  @Permissions('progress.submit')
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
  @Permissions('progress.review')
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
  @Permissions('progress.review')
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

  @Post(':id/files')
  @Permissions('progress.edit')
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
  @Permissions('progress.edit')
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
