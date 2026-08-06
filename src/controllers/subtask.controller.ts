import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { CancelSubTaskDto, UpdateSubTaskDto } from '../dtos/subtasks.dto';
import { ReportsService } from '../services/reports.service';
import { SubTasksService } from '../services/subtask.service';
import type { AccessTokenPayload } from '../types/auth';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Subtasks')
@ApiBearerAuth()
@Controller('subtasks')
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
  @ResponseMessage('Hủy nhiệm vụ con thành công')
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

  @Patch(':id')
  @ResponseMessage('Cập nhật nhiệm vụ con thành công')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSubTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.SubTaskService.update(id, body, principal, requestMeta(request));
  }

  @Delete(':id')
  @ResponseMessage('Xóa nhiệm vụ con thành công')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.SubTaskService.remove(id, principal, requestMeta(request));
  }
}
