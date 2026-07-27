import { Frequency } from '@prisma/client';
export declare class SaveReportDraftDto {
    content: string;
}
export declare class RejectReportDto {
    reason: string;
}
export declare class ReportHistoryQueryDto {
    page: number;
    limit: number;
    taskCode?: string;
    taskName?: string;
    submittedFrom?: string;
    submittedTo?: string;
    reportingPeriod?: Frequency;
    dueAt?: string;
    programId?: number;
}
