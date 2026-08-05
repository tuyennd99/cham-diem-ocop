import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import {
  CancelSubTaskDto,
  CreateSubTaskDto
} from '../dtos/subtasks.dto';
import { ReportsService } from '../services/reports.service';
import { SubTasksService } from '../services/subtask.service';
import type { AccessTokenPayload } from '../types/auth';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Subtasks')
@ApiBearerAuth()
@Controller('subtask')
export class SubTasksController {
  constructor(
    private readonly SubTaskService: SubTasksService,
    private readonly reportsService: ReportsService,
  ) { }

  @Get(':id/report-workspaces')
  listReportWorkspaces(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reportsService.listSubtaskWorkspaces(id, principal);
  }

  @Post(':id/cancel')
  @ResponseMessage('Hủy kỳ báo cáo thành công')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CancelSubTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.SubTaskService.cancel(
      id,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

  @Get(':id/subtask')
  getSubTasks(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.SubTaskService.list(id, principal);
  }

  @Post(':id/subtask')
  @ResponseMessage('Tạo kỳ báo cáo thành công')
  createSubTasks(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateSubTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.SubTaskService.create(
      id,
      body,
      principal,
      requestMeta(request),
    );
  }
}
