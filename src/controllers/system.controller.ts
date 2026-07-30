import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import {
  CreateOrganizationDto,
  CreatePermissionGroupDto,
  CreateProgramDto,
  CreateUserDto,
  LockUserDto,
  ResetPasswordDto,
  UpdateOrganizationDto,
  UpdatePermissionGroupDto,
  UpdateProgramDto,
  UpdateUserDto,
} from '../dtos/system.dto';
import { SystemService } from '../services/system.service';
import type { AccessTokenPayload, RequestMeta } from '../types/auth';

@ApiTags('System administration')
@ApiBearerAuth()
@Controller('system')
export class SystemController {
  constructor(private readonly service: SystemService) {}

  @Get('users')
  @Permissions('users.manage')
  listUsers() {
    return this.service.listUsers();
  }

  @Get('users/:id')
  @Permissions('users.manage')
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.service.getUser(id);
  }

  @Post('users')
  @Permissions('users.manage')
  @ResponseMessage('Tạo người dùng thành công')
  createUser(
    @Body() body: CreateUserDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.createUser(body, actor.sub, this.requestMeta(request));
  }

  @Patch('users/:id')
  @Permissions('users.manage')
  @ResponseMessage('Cập nhật người dùng thành công')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.updateUser(
      id,
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Delete('users/:id')
  @Permissions('users.manage')
  @ResponseMessage('Xóa người dùng thành công')
  deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.deleteUser(id, actor.sub, this.requestMeta(request));
  }

  @Post('users/:id/lock')
  @HttpCode(200)
  @Permissions('users.manage')
  @ResponseMessage('Khóa người dùng thành công')
  lockUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: LockUserDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.lockUser(
      id,
      body.reason,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Post('users/:id/unlock')
  @HttpCode(200)
  @Permissions('users.manage')
  @ResponseMessage('Mở khóa người dùng thành công')
  unlockUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.unlockUser(id, actor.sub, this.requestMeta(request));
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  @Permissions('users.manage')
  @ResponseMessage('Đặt lại mật khẩu thành công')
  resetUserPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResetPasswordDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.resetUserPassword(
      id,
      body.password,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Get('organizations')
  @Permissions('organizations.manage')
  listOrganizations() {
    return this.service.listOrganizations();
  }

  @Get('organizations/:id')
  @Permissions('organizations.manage')
  getOrganization(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOrganization(id);
  }

  @Post('organizations')
  @Permissions('organizations.manage')
  @ResponseMessage('Tạo đơn vị thành công')
  createOrganization(
    @Body() body: CreateOrganizationDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.createOrganization(
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Patch('organizations/:id')
  @Permissions('organizations.manage')
  @ResponseMessage('Cập nhật đơn vị thành công')
  updateOrganization(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateOrganizationDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.updateOrganization(
      id,
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Delete('organizations/:id')
  @Permissions('organizations.manage')
  @ResponseMessage('Xóa đơn vị thành công')
  deleteOrganization(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.deleteOrganization(
      id,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Get('programs')
  @Permissions('programs.manage')
  listPrograms() {
    return this.service.listPrograms();
  }

  @Get('programs/:id')
  @Permissions('programs.manage')
  getProgram(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProgram(id);
  }

  @Post('programs')
  @Permissions('programs.manage')
  @ResponseMessage('Tạo chương trình thành công')
  createProgram(
    @Body() body: CreateProgramDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.createProgram(
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Patch('programs/:id')
  @Permissions('programs.manage')
  @ResponseMessage('Cập nhật chương trình thành công')
  updateProgram(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProgramDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.updateProgram(
      id,
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Delete('programs/:id')
  @Permissions('programs.manage')
  @ResponseMessage('Xóa chương trình thành công')
  deleteProgram(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.deleteProgram(id, actor.sub, this.requestMeta(request));
  }

  @Get('permission-groups')
  @Permissions('permission_groups.manage')
  listPermissionGroups() {
    return this.service.listPermissionGroups();
  }

  @Get('permission-groups/:id')
  @Permissions('permission_groups.manage')
  getPermissionGroup(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPermissionGroup(id);
  }

  @Post('permission-groups')
  @Permissions('permission_groups.manage')
  @ResponseMessage('Tạo nhóm quyền thành công')
  createPermissionGroup(
    @Body() body: CreatePermissionGroupDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.createPermissionGroup(
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Patch('permission-groups/:id')
  @Permissions('permission_groups.manage')
  @ResponseMessage('Cập nhật nhóm quyền thành công')
  updatePermissionGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePermissionGroupDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.updatePermissionGroup(
      id,
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Delete('permission-groups/:id')
  @Permissions('permission_groups.manage')
  @ResponseMessage('Xóa nhóm quyền thành công')
  deletePermissionGroup(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.deletePermissionGroup(
      id,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Get('permissions')
  @Permissions('permission_groups.manage')
  listPermissions() {
    return this.service.listPermissions();
  }

  private requestMeta(request: Request): RequestMeta {
    const requestId = request.headers['x-request-id'];
    return {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
      requestId:
        typeof requestId === 'string' &&
        /^[A-Za-z0-9._-]{1,100}$/.test(requestId)
          ? requestId
          : undefined,
    };
  }
}
