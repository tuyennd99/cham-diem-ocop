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
import {
  CreateOrganizationDto,
  CreatePermissionGroupDto,
  CreateProgramDto,
  CreateUserDto,
  CreateUserGroupDto,
  LockUserDto,
  ResetPasswordDto,
  UpdateOrganizationDto,
  UpdatePermissionGroupDto,
  UpdateProgramDto,
  UpdateUserDto,
  UpdateUserGroupDto,
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
  createUser(
    @Body() body: CreateUserDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.createUser(body, actor.sub, this.requestMeta(request));
  }

  @Patch('users/:id')
  @Permissions('users.manage')
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

  @Get('user-groups')
  @Permissions('users.manage')
  listUserGroups() {
    return this.service.listUserGroups();
  }

  @Get('user-groups/:id')
  @Permissions('users.manage')
  getUserGroup(@Param('id', ParseIntPipe) id: number) {
    return this.service.getUserGroup(id);
  }

  @Post('user-groups')
  @Permissions('users.manage')
  createUserGroup(
    @Body() body: CreateUserGroupDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.createUserGroup(
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Patch('user-groups/:id')
  @Permissions('users.manage')
  updateUserGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateUserGroupDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.updateUserGroup(
      id,
      body,
      actor.sub,
      this.requestMeta(request),
    );
  }

  @Delete('user-groups/:id')
  @Permissions('users.manage')
  deleteUserGroup(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.deleteUserGroup(
      id,
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
