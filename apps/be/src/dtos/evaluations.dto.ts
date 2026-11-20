import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluationStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type {
  EvaluationRecordStatus,
  JudgeQueueQuery,
  JudgeQueueSortBy,
  SortDirection,
} from '@ocop/shared';
import {
  judgeQueueSortByValues,
  sortDirectionValues,
} from '../constants/products';

import { trimSearch as trimString } from './common.dto';

export class JudgeQueueQueryDto implements JudgeQueueQuery {
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

  @ApiPropertyOptional({ enum: EvaluationStatus })
  @IsOptional()
  @IsEnum(EvaluationStatus)
  evaluationStatus?: EvaluationRecordStatus;

  @ApiPropertyOptional({ enum: judgeQueueSortByValues })
  @IsOptional()
  @IsIn(judgeQueueSortByValues)
  sortBy?: JudgeQueueSortBy;

  @ApiPropertyOptional({ enum: sortDirectionValues })
  @IsOptional()
  @IsIn(sortDirectionValues)
  sortDirection?: SortDirection;
}

export class EvaluationScoreDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  subCriterionId!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  optionId!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

export class SaveEvaluationDto {
  @ApiProperty({ type: () => [EvaluationScoreDto], maxItems: 1000 })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique((score: EvaluationScoreDto | null) => score?.subCriterionId)
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreDto)
  scores!: EvaluationScoreDto[];

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  versionToken?: string;
}

export class SubmitEvaluationDto {
  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  versionToken?: string;
}
