import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { AuditLogsQueryDto } from '../dtos/observability.dto';
import { AuditService } from '../services/audit.service';
import type { AccessTokenPayload } from '../types/auth';

@ApiTags('Audit logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @Permissions('audit.read')
  list(
    @Query() query: AuditLogsQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.service.list(query, principal);
  }
}
