import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Frequency } from '@prisma/client';

export class SaveReportDraftDto {
  @ApiProperty()
  @IsString()
  content!: string;
}

export class RejectReportDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class ReportHistoryQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taskCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  taskName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  submittedFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  submittedTo?: string;

  @ApiPropertyOptional({ enum: Frequency })
  @IsOptional()
  @IsEnum(Frequency)
  reportingPeriod?: Frequency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId?: number;
}
