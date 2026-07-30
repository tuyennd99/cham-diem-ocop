import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Frequency } from '@prisma/client';

const isoDate = z.iso.datetime({ offset: true, local: true });

const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export class NotificationsQueryDto extends createZodDto(
  z.strictObject({
    ...paginationShape,
    unreadOnly: z.stringbool().default(false),
  }),
) {}

export class DashboardQueryDto extends createZodDto(
  z.strictObject({
    taskCode: z.string().max(100).optional(),
    taskName: z.string().max(500).optional(),
    frequency: z.enum(Frequency).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    sequence: z.coerce.number().int().min(1).max(12).optional(),
    programId: z.coerce.number().int().min(1).optional(),
    dueFrom: isoDate.optional(),
    dueTo: isoDate.optional(),
  }),
) {}

export class AuditLogsQueryDto extends createZodDto(
  z.strictObject({
    ...paginationShape,
    action: z.string().max(100).optional(),
    entityType: z.string().max(100).optional(),
    entityId: z.coerce.number().int().min(1).optional(),
    actorId: z.coerce.number().int().min(1).optional(),
    organizationId: z.coerce.number().int().min(1).optional(),
    createdFrom: isoDate.optional(),
    createdTo: isoDate.optional(),
  }),
) {}
