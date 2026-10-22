import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { StaffPermission } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import {
  AdminProductsQueryDto,
  CreateJudgeDto,
  ReplaceAssignmentsDto,
  ResetJudgePasswordDto,
  UpdateJudgeDto,
  UpdateStaffAccessDto,
} from '../dtos/admin.dto';
import { AdminService } from '../services/admin.service';
import type { AccessTokenPayload, AuthenticatedPrincipal } from '../types/auth';

@ApiTags('Admin')
@ApiBearerAuth()
@Permissions(StaffPermission.MANAGE)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @Permissions(StaffPermission.VIEW)
  dashboard(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.admin.dashboard(principal.staffPermissions.includes(StaffPermission.MANAGE));
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
  @Permissions(StaffPermission.VIEW)
  assignments() {
    return this.admin.listAssignments();
  }

  @Put('assignments')
  @ResponseMessage('Cập nhật phân công thành công')
  replaceAssignments(@Body() body: ReplaceAssignmentsDto, @CurrentUser() principal: AccessTokenPayload, @Req() request: Request) {
    return this.admin.replaceAssignments(body, principal.sub, this.requestMeta(request));
  }

  @Get('products')
  @Permissions(StaffPermission.VIEW)
  products(@Query() query: AdminProductsQueryDto, @CurrentUser() principal: AuthenticatedPrincipal) {
    return this.admin.listProducts(query, principal.staffPermissions.includes(StaffPermission.MANAGE));
  }

  @Get('products/:id/results')
  @Permissions(StaffPermission.VIEW)
  results(@Param('id') id: string, @CurrentUser() principal: AuthenticatedPrincipal) {
    return this.admin.productResults(id, principal.staffPermissions.includes(StaffPermission.MANAGE));
  }

  @Put('users/:id/staff-access')
  updateStaffAccess(@Param('id') id: string, @Body() body: UpdateStaffAccessDto, @CurrentUser() principal: AccessTokenPayload, @Req() request: Request) {
    return this.admin.updateStaffAccess(id, body, principal.sub, this.requestMeta(request));
  }

  private requestMeta(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.get('user-agent')?.slice(0, 500),
      requestId: request.get('x-request-id')?.slice(0, 100),
    };
  }
}
