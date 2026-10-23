import { Controller, Get, Query } from '@nestjs/common';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { PublicLocalitiesQueryDto } from '../dtos/admin-catalogs.dto';
import { AdminCatalogsService } from '../services/admin-catalogs.service';

@ApiTags('Localities')
@ApiExtraModels(PublicLocalitiesQueryDto)
@Controller('localities')
export class LocalitiesController {
  constructor(private readonly catalogs: AdminCatalogsService) {}

  @Public()
  @Get()
  list(@Query() query: PublicLocalitiesQueryDto) {
    return this.catalogs.listPublicLocalities(query);
  }
}
