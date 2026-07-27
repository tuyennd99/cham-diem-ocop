import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { ReportHistoryQueryDto } from '../dtos/reports.dto';
import { FilesService } from '../services/files.service';
import { ReportsService } from '../services/reports.service';
import type { AccessTokenPayload } from '../types/auth';
import { asDownload } from '../utils/private-storage';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Report history')
@ApiBearerAuth()
@Permissions('report_history.read')
@Controller('report-history')
export class ReportHistoryController {
  constructor(
    private readonly reports: ReportsService,
    private readonly files: FilesService,
  ) {}

  @Get()
  list(
    @Query() query: ReportHistoryQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reports.history(query, principal);
  }

  @Get('versions/:versionId/files/:fileId/download')
  async download(
    @Param('versionId', ParseIntPipe) versionId: number,
    @Param('fileId', ParseIntPipe) fileId: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return asDownload(
      await this.files.downloadVersionFile(
        versionId,
        fileId,
        principal,
        requestMeta(request),
      ),
    );
  }
}
