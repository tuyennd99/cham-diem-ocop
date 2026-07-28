import { ApiPropertyOptional } from '@nestjs/swagger';
import { Frequency } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

class PaginationQueryDto {
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
}

export class NotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  unreadOnly = false;
}

export class DashboardQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taskCode?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  taskName?: string;

  @ApiPropertyOptional({ enum: Frequency })
  @IsOptional()
  @IsEnum(Frequency)
  frequency?: Frequency;

  @ApiPropertyOptional({ minimum: 2000, maximum: 2100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  sequence?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueTo?: string;
}

export class AuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityType?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entityId?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  actorId?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organizationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
