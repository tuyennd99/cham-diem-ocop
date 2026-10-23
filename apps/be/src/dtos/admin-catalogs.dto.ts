import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  AdminCategoryQuery,
  CreateAdminCategoryInput,
  CreateProductGroupInput,
  ProductGroupQuery,
  UpdateAdminCategoryInput,
  UpdateProductGroupInput,
} from '@ocop/shared';

const trimString = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;
const strictBoolean = ({ value }: TransformFnParams) =>
  value === 'true' ? true : value === 'false' ? false : value;

abstract class CatalogQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  q?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class ProductGroupsQueryDto
  extends CatalogQueryDto
  implements ProductGroupQuery {}

export class AdminCategoriesQueryDto
  extends CatalogQueryDto
  implements AdminCategoryQuery
{
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  groupId?: string;
}

export class CreateProductGroupDto implements CreateProductGroupInput {
  @ApiProperty({ minLength: 1, maxLength: 50 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class UpdateProductGroupDto implements UpdateProductGroupInput {
  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class CreateAdminCategoryDto implements CreateAdminCategoryInput {
  @ApiProperty({ maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  groupId!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  classificationGroup!: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  classificationSubgroup?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  order?: number;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class UpdateAdminCategoryDto implements UpdateAdminCategoryInput {
  @ApiPropertyOptional({ maxLength: 100 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  groupId?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  classificationGroup?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 255 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  classificationSubgroup?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}
