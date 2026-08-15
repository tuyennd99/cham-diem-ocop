import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ReportsService } from '../services/reports.service';
import type { AccessTokenPayload } from '../types/auth';

@ApiTags('Task report workspaces')
@ApiBearerAuth()
@Controller('tasks')
export class SubTasksController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':taskId/report-workspaces')
  listReportWorkspaces(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.reportsService.listTaskWorkspaces(taskId, principal);
  }
}
