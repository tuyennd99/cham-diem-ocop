import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { Roles } from '../decorators/roles.decorator';
import {
  AdminProductsQueryDto,
  CreateJudgeDto,
  ReplaceAssignmentsDto,
  ResetJudgePasswordDto,
  UpdateJudgeDto,
} from '../dtos/admin.dto';
import { AdminService } from '../services/admin.service';
import type { AccessTokenPayload } from '../types/auth';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('judges')
  listJudges() {
    return this.admin.listJudges();
  }

  @Post('judges')
  @ResponseMessage('Tạo tài khoản giám khảo thành công')
  createJudge(@Body() body: CreateJudgeDto, @CurrentUser() principal: AccessTokenPayload, @Req() request: Request) {
    return this.admin.createJudge(body, principal.sub, this.requestMeta(request));
  }

  @Put('judges/:id')
  @ResponseMessage('Cập nhật giám khảo thành công')
  updateJudge(@Param('id') id: string, @Body() body: UpdateJudgeDto, @CurrentUser() principal: AccessTokenPayload, @Req() request: Request) {
    return this.admin.updateJudge(id, body, principal.sub, this.requestMeta(request));
  }

  @Delete('judges/:id')
  @ResponseMessage('Ngừng hoạt động tài khoản giám khảo thành công')
  deactivateJudge(@Param('id') id: string, @CurrentUser() principal: AccessTokenPayload, @Req() request: Request) {
    return this.admin.deactivateJudge(id, principal.sub, this.requestMeta(request));
  }

  @Post('judges/:id/reset-password')
  @ResponseMessage('Đặt lại mật khẩu giám khảo thành công')
  resetPassword(@Param('id') id: string, @Body() body: ResetJudgePasswordDto, @CurrentUser() principal: AccessTokenPayload, @Req() request: Request) {
    return this.admin.resetJudgePassword(id, body, principal.sub, this.requestMeta(request));
  }

  @Get('assignments')
  assignments() {
    return this.admin.listAssignments();
  }

  @Put('assignments')
  @ResponseMessage('Cập nhật phân công thành công')
  replaceAssignments(@Body() body: ReplaceAssignmentsDto, @CurrentUser() principal: AccessTokenPayload, @Req() request: Request) {
    return this.admin.replaceAssignments(body, principal.sub, this.requestMeta(request));
  }

  @Get('products')
  products(@Query() query: AdminProductsQueryDto) {
    return this.admin.listProducts(query);
  }

  @Get('products/:id/results')
  results(@Param('id') id: string) {
    return this.admin.productResults(id);
  }

  private requestMeta(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent')?.slice(0, 500),
      requestId: request.get('x-request-id')?.slice(0, 100),
    };
  }
}
