import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../decorators/admin-only.decorator';
import { AuditLogsQueryDto } from '../dtos/observability.dto';
import { AuditService } from '../services/audit.service';

@ApiTags('Audit logs')
@ApiBearerAuth()
@AdminOnly()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditService) { }

  @Get()
  list(@Query() query: AuditLogsQueryDto) {
    return this.service.list(query);
  }
}
