import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Frequency } from '@prisma/client';

const isoDate = z.iso.datetime({ offset: true, local: true });

export class SaveReportDraftDto extends createZodDto(
  z.strictObject({ content: z.string() }),
) { }

export class RejectReportDto extends createZodDto(
  z.strictObject({ reason: z.string().min(1).max(1000) }),
) { }

const openProgressQuery = z.strictObject({
  ownerOrganizationId: z.coerce.number().int().optional(),
});
export class OpenProgressQueryDto extends createZodDto(openProgressQuery) { }

export class ReportHistoryQueryDto extends createZodDto(
  z.strictObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    taskCode: z.string().max(100).optional(),
    taskName: z.string().max(500).optional(),
    submittedFrom: isoDate.optional(),
    submittedTo: isoDate.optional(),
    subtask: z.enum(Frequency).optional(),
    dueAt: isoDate.optional(),
    programId: z.coerce.number().int().min(1).optional(),
  }),
) { }
