import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const createSubTaskSchema = z.strictObject({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  startAt: z.string(),
  dueAt: z.string(),
});

export class CreateSubTaskDto extends createZodDto(createSubTaskSchema) { }

export class UpdateSubTaskDto extends createZodDto(createSubTaskSchema.partial()) { }

export class CancelSubTaskDto extends createZodDto(
  z.strictObject({ reason: z.string().min(1).max(1000) }),
) { }

