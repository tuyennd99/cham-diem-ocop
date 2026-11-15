import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RegistrationUnitWriteDto } from '../dtos/products.dto';
import { ProductsService } from '../services/products.service';
import type { AccessTokenPayload } from '../types/auth';

@ApiTags('My registration units')
@ApiBearerAuth()
@Roles(Role.REGISTRANT)
@Controller('my/registration-units')
export class MyRegistrationUnitsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.service.listRegistrationUnits(user.sub);
  }

  @Post()
  @ResponseMessage('Thêm đơn vị đăng ký thành công')
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: RegistrationUnitWriteDto,
  ) {
    return this.service.createRegistrationUnit(user.sub, dto);
  }

  @Put(':id')
  @ResponseMessage('Cập nhật đơn vị đăng ký thành công')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: RegistrationUnitWriteDto,
  ) {
    return this.service.updateRegistrationUnit(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Xóa đơn vị đăng ký thành công')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.service.removeRegistrationUnit(id, user.sub);
  }
}
