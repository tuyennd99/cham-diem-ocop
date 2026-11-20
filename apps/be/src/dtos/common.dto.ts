import { BadRequestException } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { PaginatedMeta } from '@ocop/shared';

export const trimRequired = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const trimSearch = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export const trimNullableOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export const normalizedEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export const parseQueryBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export const MAX_PAGINATION_PAGE = 100_000;
export const MAX_PAGINATION_LIMIT = 100;

export class PaginationQueryDto {
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

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_PAGINATION_LIMIT,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGINATION_LIMIT)
  limit = 20;
}

export function toPaginatedResponse<
  T,
  E extends Record<string, unknown> = Record<string, never>,
>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  extraMeta?: E,
): { data: T[]; meta: PaginatedMeta & E } {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      ...(extraMeta ?? ({} as E)),
    },
  };
}

export const MAX_DB_INT4 = 2_147_483_647;

export function computeSafePaginationSkip(page: number, limit: number): number {
  const skip = (page - 1) * limit;
  if (
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    !Number.isSafeInteger(skip)
  ) {
    throw new BadRequestException('Pagination exceeds the safe integer range');
  }
  return skip;
}

export function computePaginationSkip(page: number, limit: number): number {
  const skip = computeSafePaginationSkip(page, limit);
  if (skip > MAX_DB_INT4) {
    throw new BadRequestException('Pagination exceeds the safe integer range');
  }
  return skip;
}
