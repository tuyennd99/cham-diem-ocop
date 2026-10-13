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
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from '../dtos/tasks.dto';
import { TasksService } from '../services/tasks.service';
import type { AccessTokenPayload } from '../types/auth';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(
    @Query() query: TaskQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.tasksService.list(query, principal);
  }

  @Post()
  @ResponseMessage('Tạo nhiệm vụ con thành công')
  create(
    @Body() body: CreateTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.create(body, principal, requestMeta(request));
  }

  @Get('lookups/programs')
  programLookups() {
    return this.tasksService.listProgramLookups();
  }

  @Get('lookups/organizations')
  organizationLookups() {
    return this.tasksService.listOrganizationLookups();
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.tasksService.get(id, principal);
  }

  @Patch(':id')
  @ResponseMessage('Cập nhật nhiệm vụ con thành công')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.update(id, body, principal, requestMeta(request));
  }

  @Delete(':id')
  @ResponseMessage('Xóa nhiệm vụ con thành công')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.remove(id, principal, requestMeta(request));
  }
}
