import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
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
  AdminReportFilterQuery,
  AdminReportQuery,
  ProductRegistrationType,
  ReportGroupBy,
} from '@ocop/shared';
import {
  productRegistrationTypes,
  reportGroupByValues,
} from '../constants/products';

export { reportGroupByValues };

const trimString = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class AdminDashboardQueryDto implements AdminReportFilterQuery {
  @ApiPropertyOptional({ minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  queuePage?: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(100)
  queueSearch?: string;

  @ApiPropertyOptional({ minimum: 2020, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  localityId?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  categoryId?: string;

  @ApiPropertyOptional({ enum: productRegistrationTypes })
  @IsOptional()
  @IsIn(productRegistrationTypes)
  registrationType?: ProductRegistrationType;

  @ApiPropertyOptional({ minimum: 2020, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  assessmentYear?: number;
}

export class AdminReportQueryDto
  extends AdminDashboardQueryDto
  implements AdminReportQuery
{
  @ApiPropertyOptional({ enum: reportGroupByValues })
  @IsOptional()
  @IsIn(reportGroupByValues)
  groupBy?: ReportGroupBy;
}
