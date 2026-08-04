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
import { AdminOnly } from '../decorators/admin-only.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import {
  CreateOrganizationDto,
  CreateProgramDto,
  CreateUserDto,
  LockUserDto,
  ResetPasswordDto,
  UpdateOrganizationDto,
  UpdateProgramDto,
  UpdateUserDto,
} from '../dtos/system.dto';
import { SystemService } from '../services/system.service';
import type { AccessTokenPayload, RequestMeta } from '../types/auth';

@ApiTags('System administration')
@ApiBearerAuth()
@AdminOnly()
@Controller('system')
export class SystemController {
  constructor(private readonly service: SystemService) {}

  @Get('users')
  listUsers() {
    return this.service.listUsers();
  }

  @Get('users/:id')
  getUser(@Param('id', ParseIntPipe) id: number) {
    return this.service.getUser(id);
  }

  @Post('users')
  @ResponseMessage('Tạo người dùng thành công')
  createUser(
    @Body() body: CreateUserDto,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.createUser(body, actor.sub, this.requestMeta(request));
  }

  @Patch('users/:id')
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
  listOrganizations() {
    return this.service.listOrganizations();
  }

  @Get('organizations/:id')
  getOrganization(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOrganization(id);
  }

  @Post('organizations')
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
  listPrograms() {
    return this.service.listPrograms();
  }

  @Get('programs/:id')
  getProgram(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProgram(id);
  }

  @Post('programs')
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
  @ResponseMessage('Xóa chương trình thành công')
  deleteProgram(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: AccessTokenPayload,
    @Req() request: Request,
  ) {
    return this.service.deleteProgram(id, actor.sub, this.requestMeta(request));
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
