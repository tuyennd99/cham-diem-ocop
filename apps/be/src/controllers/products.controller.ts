import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { ResponseMessage } from '../decorators/response-message.decorator';
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
    return this.products.listPublic(query.page, query.limit, query.categoryId, query.q);
  }

  @Public()
  @Get(':id/attachments/:attachmentId')
  @ResponseMessage('Tải ảnh sản phẩm thành công')
  async image(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ): Promise<StreamableFile> {
    return asDownload(await this.products.getPublicAttachment(id, attachmentId), 'inline');
  }

  @Public()
  @Get(':id')
  detail(@Param('id') id: string) {
    return this.products.getPublic(id);
  }
}
