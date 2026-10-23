import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { LocalityType as PrismaLocalityType } from '@prisma/client';
import type {
  AdminCategoryQuery,
  CreateAdminCategoryInput,
  CreateLocalityInput,
  CreateProductGroupInput,
  LocalityQuery,
  PublicLocalityQuery,
  LocalityType,
  ProductGroupQuery,
  UpdateLocalityInput,
  UpdateAdminCategoryInput,
  UpdateProductGroupInput,
} from '@ocop/shared';

const trimString = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;
const strictBoolean = ({ value }: TransformFnParams) =>
  value === 'true' ? true : value === 'false' ? false : value;
const ISO_TIMESTAMP_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i;

@ValidatorConstraint({ name: 'effectiveToAfterFrom', async: false })
class EffectiveToAfterFrom implements ValidatorConstraintInterface {
  validate(effectiveTo: string | null | undefined, args: ValidationArguments) {
    const effectiveFrom = (args.object as { effectiveFrom?: string | null })
      .effectiveFrom;
    return (
      !effectiveTo ||
      !effectiveFrom ||
      new Date(effectiveTo).getTime() > new Date(effectiveFrom).getTime()
    );
  }

  defaultMessage() {
    return 'effectiveTo must be later than effectiveFrom';
  }
}

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

abstract class LocalitiesQueryDto {
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

  @ApiPropertyOptional({ enum: PrismaLocalityType })
  @IsOptional()
  @IsEnum(PrismaLocalityType)
  type?: LocalityType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  provinceName?: string;
}

export class AdminLocalitiesQueryDto
  extends LocalitiesQueryDto
  implements LocalityQuery
{
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class PublicLocalitiesQueryDto
  extends LocalitiesQueryDto
  implements PublicLocalityQuery {}

export class CreateLocalityDto implements CreateLocalityInput {
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

  @ApiProperty({ enum: PrismaLocalityType })
  @IsEnum(PrismaLocalityType)
  type!: LocalityType;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  provinceName!: string;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsDateString({ strict: true })
  @Matches(ISO_TIMESTAMP_WITH_OFFSET)
  effectiveFrom?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsDateString({ strict: true })
  @Matches(ISO_TIMESTAMP_WITH_OFFSET)
  @Validate(EffectiveToAfterFrom)
  effectiveTo?: string | null;

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

export class UpdateLocalityDto implements UpdateLocalityInput {
  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ enum: PrismaLocalityType })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(PrismaLocalityType)
  type?: LocalityType;

  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  provinceName?: string;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsDateString({ strict: true })
  @Matches(ISO_TIMESTAMP_WITH_OFFSET)
  effectiveFrom?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsDateString({ strict: true })
  @Matches(ISO_TIMESTAMP_WITH_OFFSET)
  @Validate(EffectiveToAfterFrom)
  effectiveTo?: string | null;

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
