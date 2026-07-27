import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../prisma/client';
import {
  AuditAppendInput,
  AuditListFilters,
  AuditRepository,
} from '../repositories/audit.repository';
import { AccessTokenPayload } from '../types/auth';

const SECRET_FIELD =
  /password|passcode|token|cookie|secret|authorization|storageKey|checksum|binary|dataUrl|buffer/i;

@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  append(
    input: Omit<AuditAppendInput, 'beforeData' | 'afterData'> & {
      beforeData?: unknown;
      afterData?: unknown;
    },
  ) {
    const { beforeData, afterData, ...fields } = input;
    return this.repository.append({
      ...fields,
      ...(beforeData === undefined
        ? {}
        : { beforeData: this.sanitizeJson(beforeData) ?? null }),
      ...(afterData === undefined
        ? {}
        : { afterData: this.sanitizeJson(afterData) ?? null }),
    });
  }

  async list(filters: AuditListFilters, principal: AccessTokenPayload) {
    if (!principal.isAdmin && !principal.permissions.includes('audit.read')) {
      throw new ForbiddenException('audit.read is required');
    }
    const { data, total } = await this.repository.list(filters);
    return {
      data: data.map((row) => ({
        ...row,
        beforeData: this.sanitizeJson(row.beforeData) ?? null,
        afterData: this.sanitizeJson(row.afterData) ?? null,
      })),
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  private sanitizeJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === null) return undefined;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
      return value
        .map((item) => this.sanitizeJson(item))
        .filter((item): item is Prisma.InputJsonValue => item !== undefined);
    }
    if (typeof value === 'object') {
      const sanitized: Record<string, Prisma.InputJsonValue> = {};
      for (const [key, item] of Object.entries(
        value as Record<string, unknown>,
      )) {
        if (SECRET_FIELD.test(key)) continue;
        const safe = this.sanitizeJson(item);
        if (safe !== undefined) sanitized[key] = safe;
      }
      return sanitized;
    }
    return undefined;
  }
}
