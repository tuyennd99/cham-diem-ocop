import {
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { PublicProductQueryDto } from '../dtos/products.dto';
import { ProductsService } from '../services/products.service';
import { asDownload } from '../utils/private-storage';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  list(@Query() query: PublicProductQueryDto) {
    return this.products.listPublic(query);
  }

  @Public()
  @Get(':id/attachments/:attachmentId')
  @Header('Cache-Control', 'public, max-age=86400, immutable')
  async image(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Headers('range') rangeHeader?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    return asDownload(
      await this.products.getPublicAttachment(id, attachmentId, rangeHeader),
      'inline',
      res,
    );
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.products.getPublic(id);
  }
}
