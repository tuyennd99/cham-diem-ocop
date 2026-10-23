import type { Prisma } from '@prisma/client';
import type { RequestMeta } from '../types/auth';

export interface AuditInput extends RequestMeta {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string;
}

export function writeAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeData: input.beforeData as Prisma.InputJsonValue | undefined,
      afterData: input.afterData as Prisma.InputJsonValue | undefined,
      reason: input.reason,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      requestId: input.requestId,
    },
  });
}
