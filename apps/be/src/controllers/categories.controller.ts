import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { ProductsService } from '../services/products.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  list() {
    return this.products.categories();
  }
}
