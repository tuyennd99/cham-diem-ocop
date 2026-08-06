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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import {
  CreateTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from '../dtos/tasks.dto';
import { CreateSubTaskDto } from '../dtos/subtasks.dto';
import { SubTasksService } from '../services/subtask.service';
import { ReportsService } from '../services/reports.service';
import { TasksService } from '../services/tasks.service';
import type { AccessTokenPayload } from '../types/auth';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly SubTaskService: SubTasksService,
  ) { }

  @Get()
  list(
    @Query() query: TaskQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.tasksService.list(query, principal);
  }

  @Post()
  @ResponseMessage('Tạo nhiệm vụ thành công')
  create(
    @Body() body: CreateTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.create(body, principal, requestMeta(request));
  }

  @Get('lookups/organizations')
  organizationLookups(@CurrentUser() principal: AccessTokenPayload) {
    return this.tasksService.listOrganizationLookups(principal);
  }

  @Get('lookups/programs')
  programLookups(@CurrentUser() principal: AccessTokenPayload) {
    return this.tasksService.listProgramLookups(principal);
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.tasksService.get(id, principal);
  }

  @Patch(':id')
  @ResponseMessage('Cập nhật nhiệm vụ thành công')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.update(id, body, principal, requestMeta(request));
  }

  @Delete(':id')
  @ResponseMessage('Xóa nhiệm vụ thành công')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.remove(id, principal, requestMeta(request));
  }

  @Get(':id/subtasks')
  listSubtasks(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.SubTaskService.list(id, principal);
  }

  @Post(':id/subtasks')
  @ResponseMessage('Tạo nhiệm vụ con thành công')
  createSubtask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateSubTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.SubTaskService.create(id, body, principal, requestMeta(request));
  }
}

