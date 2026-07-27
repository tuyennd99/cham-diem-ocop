import { Frequency, TaskType } from '@prisma/client';
export declare class CreateTaskDto {
    code: string;
    name: string;
    description?: string;
    expectedOutput?: string;
    type: TaskType;
    programId: number;
    assigningOrganizationId: number;
    leadOrganizationId: number;
    collaboratorOrganizationIds: number[];
    dueAt?: string;
    frequency?: Frequency;
    periodicStartAt?: string;
}
declare const UpdateTaskDto_base: import("@nestjs/common").Type<Partial<CreateTaskDto>>;
export declare class UpdateTaskDto extends UpdateTaskDto_base {
}
export declare class TaskQueryDto {
    page: number;
    limit: number;
}
export declare class CloseTaskDto {
    reason: string;
}
export declare class CancelReportingPeriodDto {
    reason: string;
}
export {};
