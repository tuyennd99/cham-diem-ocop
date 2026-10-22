import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type { ProductRegistrationType } from '@ocop/shared';
import { productRegistrationTypes } from '../constants/products';

const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class ProductApplicationDto {
  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  entityName?: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  representativeName?: string;

  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  representativeTitle?: string;

  @ApiPropertyOptional({ maxLength: 1000, nullable: true })
  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  contactAddress?: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  provinceName?: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(trimOptional)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ format: 'email', maxLength: 320, nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() || undefined : value,
  )
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ enum: productRegistrationTypes, nullable: true })
  @IsOptional()
  @Transform(trimOptional)
  @IsIn(productRegistrationTypes)
  registrationType?: (typeof productRegistrationTypes)[number];

  @ApiPropertyOptional({ minimum: 0, maximum: 100000, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
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
  @IsString()
  @MaxLength(100)
  categoryId!: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name!: string;

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
  @IsString()
  @MaxLength(100)
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
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
  @IsString()
  @MaxLength(100)
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;
}
