import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ProductUpdateDto, ProductWriteDto } from './products.dto';
import {
  PRODUCT_DATE_BASIS,
  SORT_DIRECTION,
  productDateBasisValues,
  productRegistrationTypes,
  productSortByValues,
  sortDirectionValues,
} from '../constants/products';

const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimSearch = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;
const parseQueryBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class AdminProductQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimSearch)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  registrantId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimSearch)
  @IsString()
  @MaxLength(100)
  registrantQ?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  localityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(parseQueryBoolean)
  @IsBoolean()
  unmappedLocality?: boolean;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ enum: productRegistrationTypes })
  @IsOptional()
  @IsIn(productRegistrationTypes)
  registrationType?: (typeof productRegistrationTypes)[number];

  @ApiPropertyOptional({ minimum: 2020, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  assessmentYear?: number;

  @ApiPropertyOptional({
    enum: productDateBasisValues,
    default: PRODUCT_DATE_BASIS.SUBMITTED_AT,
  })
  @IsOptional()
  @IsIn(productDateBasisValues)
  dateBasis: (typeof productDateBasisValues)[number] =
    PRODUCT_DATE_BASIS.SUBMITTED_AT;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i)
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/i)
  toExclusive?: string;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5] })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starRating?: 1 | 2 | 3 | 4 | 5;

  @ApiPropertyOptional({ enum: productSortByValues })
  @IsOptional()
  @IsIn(productSortByValues)
  sortBy?: (typeof productSortByValues)[number];

  @ApiPropertyOptional({
    enum: sortDirectionValues,
    default: SORT_DIRECTION.DESC,
  })
  @IsOptional()
  @IsIn(sortDirectionValues)
  sortDirection?: (typeof sortDirectionValues)[number];
}

export class AdminProductCreateDto extends ProductWriteDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  registrantId!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class AdminProductUpdateDto extends ProductUpdateDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class ProductMutationReasonDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class ApproveProductDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimSearch)
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReturnProductDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class PublishProductResultsDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimSearch)
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReopenProductDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class AddProductJudgeAssignmentDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  judgeId!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimSearch)
  @IsString()
  @MaxLength(255)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  confirmRestore?: boolean;
}

export class RemoveProductJudgeAssignmentDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimSearch)
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class ReopenEvaluationDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @Transform(trimSearch)
  @IsString()
  @MaxLength(255)
  reason?: string;
}
