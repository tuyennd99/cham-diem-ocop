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
import {
  CancelReportingPeriodDto,
  CloseTaskDto,
  CreateTaskDto,
  TaskQueryDto,
  UpdateTaskDto,
} from '../dtos/tasks.dto';
import { ReportingPeriodsService } from '../services/reporting-periods.service';
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
    private readonly reportingPeriodsService: ReportingPeriodsService,
  ) {}

  @Get()
  list(
    @Query() query: TaskQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.tasksService.list(query, principal);
  }

  @Post()
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

  @Get('lookups/user-groups')
  userGroupLookups(@CurrentUser() principal: AccessTokenPayload) {
    return this.tasksService.listUserGroupLookups(principal);
  }

  @Get(':id')
  get(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.tasksService.get(id, principal);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.update(id, body, principal, requestMeta(request));
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.remove(id, principal, requestMeta(request));
  }

  @Post(':id/close')
  close(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CloseTaskDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.close(
      id,
      body.reason,
      principal,
      requestMeta(request),
    );
  }

  @Post(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.tasksService.complete(id, principal, requestMeta(request));
  }

  @Get(':id/reporting-periods')
  periods(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reportingPeriodsService.list(id, principal);
  }
}

@ApiTags('Reporting periods')
@ApiBearerAuth()
@Controller('reporting-periods')
export class ReportingPeriodsController {
  constructor(
    private readonly reportingPeriodsService: ReportingPeriodsService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get(':id/report-workspaces')
  listReportWorkspaces(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reportsService.listPeriodWorkspaces(id, principal);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CancelReportingPeriodDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.reportingPeriodsService.cancel(
      id,
      body.reason,
      principal,
      requestMeta(request),
    );
  }
}
