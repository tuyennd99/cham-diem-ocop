import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../decorators/current-user.decorator';
import { NotificationsQueryDto } from '../dtos/observability.dto';
import { NotificationsService } from '../services/notifications.service';
import type { AccessTokenPayload } from '../types/auth';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @Query() query: NotificationsQueryDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.service.list(principal.sub, query);
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentUser() principal: AccessTokenPayload) {
    return this.service.markAllRead(principal.sub);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.service.markRead(id, principal.sub);
  }
}
