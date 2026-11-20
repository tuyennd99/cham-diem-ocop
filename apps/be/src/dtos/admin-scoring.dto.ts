import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  AdminCriteriaSetQuery,
  AdminCriteriaSetSortBy,
  AdminEvaluationQuery,
  AdminEvaluationSortBy,
  EvaluationRecordStatus,
  SortDirection,
} from '@ocop/shared';
import {
  adminCriteriaSetSortByValues,
  adminEvaluationSortByValues,
  sortDirectionValues,
} from '../constants/products';

import {
  parseQueryBoolean as strictBoolean,
  trimSearch as trimString,
} from './common.dto';

export class AdminCriteriaSetsQueryDto implements AdminCriteriaSetQuery {
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
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: adminCriteriaSetSortByValues })
  @IsOptional()
  @IsIn(adminCriteriaSetSortByValues)
  sortBy?: AdminCriteriaSetSortBy;

  @ApiPropertyOptional({ enum: sortDirectionValues })
  @IsOptional()
  @IsIn(sortDirectionValues)
  sortDirection?: SortDirection;
}

export class AdminEvaluationsQueryDto implements AdminEvaluationQuery {
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
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  productId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  judgeId?: string;

  @ApiPropertyOptional({ enum: EvaluationStatus })
  @IsOptional()
  @IsEnum(EvaluationStatus)
  status?: EvaluationRecordStatus;

  @ApiPropertyOptional({ enum: adminEvaluationSortByValues })
  @IsOptional()
  @IsIn(adminEvaluationSortByValues)
  sortBy?: AdminEvaluationSortBy;

  @ApiPropertyOptional({ enum: sortDirectionValues })
  @IsOptional()
  @IsIn(sortDirectionValues)
  sortDirection?: SortDirection;
}
