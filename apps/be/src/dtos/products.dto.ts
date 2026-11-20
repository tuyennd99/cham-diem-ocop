import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsDefined,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  PRODUCT_DATE_BASIS,
  SORT_DIRECTION,
  productDateBasisValues,
  productRegistrationTypes,
  productSortByValues,
  sortDirectionValues,
} from '../constants/products';

import {
  normalizedEmail,
  parseQueryBoolean,
  trimRequired,
  trimSearch,
} from './common.dto';

export class ProductApplicationDto {
  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  entityName?: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  representativeName?: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  representativeTitle?: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  contactAddress?: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  provinceName?: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @ValidateIf(
    (_object, value) => value !== undefined && value !== null && value !== '',
  )
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  localityName?: string;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @ValidateIf(
    (_object, value) => value !== undefined && value !== null && value !== '',
  )
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  localityCode?: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @ValidateIf(
    (_object, value) => value !== undefined && value !== null && value !== '',
  )
  @Transform(trimRequired)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ format: 'email', maxLength: 320, nullable: true })
  @ValidateIf(
    (_object, value) => value !== undefined && value !== null && value !== '',
  )
  @Transform(normalizedEmail)
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ enum: productRegistrationTypes, nullable: true })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimRequired)
  @IsIn(productRegistrationTypes)
  registrationType?: (typeof productRegistrationTypes)[number];

  @ApiPropertyOptional({ minimum: 1, maximum: 100000, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  sampleQuantity?: number;

  @ApiPropertyOptional({ minimum: 2020, maximum: 2100, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  assessmentYear?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  declarationAccepted?: boolean;
}

export class ProductWriteDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId!: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  localityId?: string | null;

  @ApiPropertyOptional({ maxLength: 10000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiProperty({ type: () => ProductApplicationDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => ProductApplicationDto)
  formData!: ProductApplicationDto;
}

export class ProductUpdateDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  localityId?: string | null;

  @ApiPropertyOptional({ maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ maxLength: 10000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({ type: () => ProductApplicationDto })
  @ValidateIf((_object, value) => value !== undefined)
  @IsObject()
  @ValidateNested()
  @Type(() => ProductApplicationDto)
  formData?: ProductApplicationDto;
}

export class PublicProductQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
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
  @IsString()
  @MaxLength(100)
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimRequired)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(parseQueryBoolean)
  @IsBoolean()
  approvedOnly?: boolean;
}

export class MyProductsQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
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
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId?: string;

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

const trimNullableOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class RegistrationUnitWriteDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  entityName!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  representativeName!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  representativeTitle!: string;

  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  contactAddress!: string;

  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  provinceName!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  localityName!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(trimNullableOptional)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  localityCode?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(trimNullableOptional)
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}
