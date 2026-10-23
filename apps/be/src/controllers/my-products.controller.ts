import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
import {
  ProductUpdateDto,
  ProductWriteDto,
} from '../dtos/products.dto';
import { ProductsService } from '../services/products.service';
import type { AccessTokenPayload } from '../types/auth';
import type { UploadedPrivateFile } from '../types/files';
import { asDownload, productUploadOptions } from '../utils/private-storage';

@ApiTags('My products')
@ApiBearerAuth()
@Roles(Role.REGISTRANT)
@Controller('my/products')
export class MyProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() principal: AccessTokenPayload) {
    return this.products.listMine(principal);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() principal: AccessTokenPayload) {
    return this.products.getMine(id, principal);
  }

  @Post()
  @ResponseMessage('Tạo hồ sơ sản phẩm thành công')
  create(@Body() body: ProductWriteDto, @CurrentUser() principal: AccessTokenPayload) {
    return this.products.create(body, principal);
  }

  @Put(':id')
  @ResponseMessage('Cập nhật hồ sơ sản phẩm thành công')
  update(
    @Param('id') id: string,
    @Body() body: ProductUpdateDto,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.products.update(id, body, principal);
  }

  @Delete(':id')
  @ResponseMessage('Xóa hồ sơ sản phẩm thành công')
  remove(@Param('id') id: string, @CurrentUser() principal: AccessTokenPayload) {
    return this.products.remove(id, principal);
  }

  @Post(':id/submit')
  @ResponseMessage('Nộp hồ sơ sản phẩm thành công')
  submit(@Param('id') id: string, @CurrentUser() principal: AccessTokenPayload) {
    return this.products.submit(id, principal);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(FileInterceptor('file', productUploadOptions()))
  upload(
    @Param('id') id: string,
    @UploadedFile() file: UploadedPrivateFile | undefined,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.products.addAttachment(id, file, principal);
  }

  @Get(':id/attachments/:attachmentId')
  async attachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() principal: AccessTokenPayload,
  ): Promise<StreamableFile> {
    return asDownload(await this.products.getMyAttachment(id, attachmentId, principal));
  }

  @Delete(':id/attachments/:attachmentId')
  @ResponseMessage('Xóa tệp hồ sơ thành công')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() principal: AccessTokenPayload,
  ) {
    return this.products.removeAttachment(id, attachmentId, principal);
  }
}
