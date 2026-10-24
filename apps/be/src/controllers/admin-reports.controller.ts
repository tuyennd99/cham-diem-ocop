import { Controller, Get, Query } from '@nestjs/common';
import { StaffPermission } from '@prisma/client';
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../decorators/permissions.decorator';
import {
  AdminDashboardQueryDto,
  AdminReportQueryDto,
} from '../dtos/admin-reports.dto';
import { AdminService } from '../services/admin.service';

@ApiTags('Admin reports')
@ApiBearerAuth()
@ApiExtraModels(AdminDashboardQueryDto, AdminReportQueryDto)
@Permissions(StaffPermission.VIEW)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly admin: AdminService) {}

  @Get('registrations')
  registrations(@Query() query: AdminReportQueryDto) {
    return this.admin.registrationsReport(query);
  }

  @Get('results')
  results(@Query() query: AdminReportQueryDto) {
    return this.admin.resultsReport(query);
  }
}
