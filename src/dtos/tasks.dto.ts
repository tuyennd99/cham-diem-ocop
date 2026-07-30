import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { Frequency, TaskType } from '@prisma/client';

const unique = (a: number[]) => new Set(a).size === a.length;
const uniqueMsg = { message: 'Giá trị trong mảng phải là duy nhất' };
const isoDate = z.iso.datetime({ offset: true, local: true });

const createTaskSchema = z.strictObject({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  expectedOutput: z.string().optional(),
  type: z.enum(TaskType),
  programId: z.coerce.number().int().min(1),
  assigningOrganizationId: z.coerce.number().int().min(1),
  leadOrganizationId: z.coerce.number().int().min(1),
  collaboratorOrganizationIds: z
    .array(z.number().int().min(1))
    .min(1)
    .refine(unique, uniqueMsg),
  dueAt: isoDate.optional(),
  frequency: z.enum(Frequency).optional(),
  periodicStartAt: isoDate.optional(),
});

export class CreateTaskDto extends createZodDto(createTaskSchema) {}

export class UpdateTaskDto extends createZodDto(createTaskSchema.partial()) {}

export class TaskQueryDto extends createZodDto(
  z.strictObject({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
) {}

export class CloseTaskDto extends createZodDto(
  z.strictObject({ reason: z.string().min(1).max(1000) }),
) {}

export class CancelReportingPeriodDto extends createZodDto(
  z.strictObject({ reason: z.string().min(1).max(1000) }),
) {}
