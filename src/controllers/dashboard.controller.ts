import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import { DashboardQueryDto } from '../dtos/observability.dto';
import { DashboardService } from '../services/dashboard.service';
import type { AccessTokenPayload } from '../types/auth';

@ApiTags('Dashboard and statistics')
@ApiBearerAuth()
@Controller()
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('dashboard/summary')
  summary(
    @Query() query: DashboardQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.service.summary(query, principal);
  }

  @Get('statistics/tasks')
  statistics(
    @Query() query: DashboardQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.service.statistics(query, principal);
  }
}
