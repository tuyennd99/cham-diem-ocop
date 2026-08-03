import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../decorators/permissions.decorator';
import { AuditLogsQueryDto } from '../dtos/observability.dto';
import { AuditService } from '../services/audit.service';
import { MAP_PERMISSIONS } from '../constants/permission';

@ApiTags('Audit logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditService) { }

  @Get()
  @Permissions(MAP_PERMISSIONS.AUDIT_READ)
  list(@Query() query: AuditLogsQueryDto) {
    return this.service.list(query);
  }
}
