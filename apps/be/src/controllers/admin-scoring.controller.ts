import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import {
  AdminCriteriaSetsQueryDto,
  AdminEvaluationsQueryDto,
} from '../dtos/admin-scoring.dto';
import { AdminService } from '../services/admin.service';
import type { AuthenticatedPrincipal } from '../types/auth';

@ApiTags('Admin scoring & print')
@ApiBearerAuth()
@ApiExtraModels(AdminCriteriaSetsQueryDto, AdminEvaluationsQueryDto)
@Controller('admin')
export class AdminScoringController {
  constructor(private readonly admin: AdminService) {}

  @Get('criteria-sets')
  listCriteriaSets(
    @Query() query: AdminCriteriaSetsQueryDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.listCriteriaSets(query, principal);
  }

  @Get('criteria-sets/:id')
  getCriteriaSet(
    @Param('id') id: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.getCriteriaSet(id, principal);
  }

  @Get('criteria-sets/:id/print-data')
  getCriteriaSetPrintData(
    @Param('id') id: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.getCriteriaSetPrintData(id, principal);
  }

  @Get('evaluations')
  listEvaluations(
    @Query() query: AdminEvaluationsQueryDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.listEvaluations(query, principal);
  }

  @Get('evaluations/:id/print-data')
  getEvaluationPrintData(
    @Param('id') id: string,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ) {
    return this.admin.getEvaluationPrintData(id, principal);
  }
}
