import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { ResponseMessage } from '../decorators/response-message.decorator';
import { ImagesService } from '../services/images.service';
import type { UploadedPrivateFile } from '../types/files';
import { imageUploadOptions } from '../utils/private-storage';

@ApiTags('Images')
@ApiBearerAuth()
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Post()
  @ResponseMessage('Tải ảnh lên thành công')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions()))
  upload(
    @UploadedFile() file: UploadedPrivateFile | undefined,
    @Req() request: Request,
  ) {
    const baseUrl = `${request.protocol}://${request.get('host')}`;
    return this.images.storeInline(file, baseUrl);
  }
}
