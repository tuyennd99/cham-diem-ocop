import { Body, Controller, Get, Param, Post, Put, StreamableFile } from '@nestjs/common';
import { StaffPermission } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { SaveEvaluationDto } from '../dtos/evaluations.dto';
import { EvaluationsService } from '../services/evaluations.service';
import type { AccessTokenPayload } from '../types/auth';
import { asDownload } from '../utils/private-storage';

@ApiTags('Judge')
@ApiBearerAuth()
@Permissions(StaffPermission.SCORE)
@Controller('judge')
export class JudgeController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get('products')
  list(@CurrentUser() principal: AccessTokenPayload) {
    return this.evaluations.listQueue(principal.sub);
  }

  @Get('products/:id/evaluation')
  get(@Param('id') id: string, @CurrentUser() principal: AccessTokenPayload) {
    return this.evaluations.getEvaluation(principal.sub, id);
  }

  @Get('products/:id/attachments/:attachmentId')
  async attachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() principal: AccessTokenPayload,
  ): Promise<StreamableFile> {
    return asDownload(await this.evaluations.attachment(principal.sub, id, attachmentId));
  }

  @Put('products/:id/evaluation')
  @ResponseMessage('Lưu bản chấm nháp thành công')
  save(
    @Param('id') id: string,
    @Body() body: SaveEvaluationDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.evaluations.saveDraft(principal.sub, id, body);
  }

  @Post('products/:id/evaluation/submit')
  @ResponseMessage('Nộp phiếu chấm thành công')
  submit(@Param('id') id: string, @CurrentUser() principal: AccessTokenPayload) {
    return this.evaluations.submit(principal.sub, id);
  }
}
