import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { StaffPermission } from '@prisma/client';
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Permissions } from '../decorators/permissions.decorator';
import {
  CreateOrganizationUnitDto,
  AdminUsersQueryDto,
  CreateAdminUserDto,
  OrganizationUnitsQueryDto,
  ResetAdminUserPasswordDto,
  UpdateAdminUserProfileDto,
  UpdateAdminUserStatusDto,
  UpdateOrganizationUnitDto,
} from '../dtos/admin-users.dto';
import { AdminUsersService } from '../services/admin-users.service';
import type { AccessTokenPayload } from '../types/auth';
import { requestMeta } from '../utils/request-meta';

@ApiTags('Admin')
@ApiBearerAuth()
@ApiExtraModels(AdminUsersQueryDto)
@Permissions(StaffPermission.MANAGE)
@Controller('admin')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get('users')
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.adminUsers.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminUsers.getUser(id);
  }

  @Post('users')
  createUser(
    @Body() body: CreateAdminUserDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.adminUsers.createUser(body, principal.sub, requestMeta(request));
  }

  @Put('users/:id')
  updateUserProfile(
    @Param('id') id: string,
    @Body() body: UpdateAdminUserProfileDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.adminUsers.updateUserProfile(
      id,
      body,
      principal.sub,
      requestMeta(request),
    );
  }

  @Put('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateAdminUserStatusDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.adminUsers.updateUserStatus(
      id,
      body,
      principal.sub,
      requestMeta(request),
    );
  }

  @Post('users/:id/reset-password')
  resetUserPassword(
    @Param('id') id: string,
    @Body() body: ResetAdminUserPasswordDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.adminUsers.resetUserPassword(
      id,
      body,
      principal.sub,
      requestMeta(request),
    );
  }

  @Get('organization-units')
  listOrganizationUnits(@Query() query: OrganizationUnitsQueryDto) {
    return this.adminUsers.listOrganizationUnits(query);
  }

  @Post('organization-units')
  createOrganizationUnit(
    @Body() body: CreateOrganizationUnitDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.adminUsers.createOrganizationUnit(
      body,
      principal.sub,
      requestMeta(request),
    );
  }

  @Put('organization-units/:id')
  updateOrganizationUnit(
    @Param('id') id: string,
    @Body() body: UpdateOrganizationUnitDto,
    @CurrentUser() principal: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.adminUsers.updateOrganizationUnit(
      id,
      body,
      principal.sub,
      requestMeta(request),
    );
  }
}
