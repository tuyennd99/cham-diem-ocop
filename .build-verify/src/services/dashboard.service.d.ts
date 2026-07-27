import { DashboardFilters, DashboardRepository } from '../repositories/dashboard.repository';
import { AccessTokenPayload } from '../types/auth';
export type DashboardStatus = 'HOAN_THANH' | 'DANG_CAP_NHAT' | 'QUA_HAN' | 'SAP_DEN_HAN' | 'CHUA_HOAN_THANH';
type StatusCounts = Record<DashboardStatus, number>;
export declare class DashboardService {
    private readonly repository;
    constructor(repository: DashboardRepository);
    summary(filters: DashboardFilters, principal: AccessTokenPayload, now?: Date): Promise<{
        totalTasks: number;
        taskCounts: {
            total: number;
            typeCounts: {
                DINH_KY: number;
                DOT_XUAT: number;
            };
            statusCounts: StatusCounts;
        };
        periodCounts: {
            total: number;
            periodic: number;
            statusCounts: StatusCounts;
        };
    }>;
    statistics(filters: DashboardFilters, principal: AccessTokenPayload, now?: Date): Promise<{
        totalTasks: number;
        taskCounts: {
            total: number;
            typeCounts: {
                DINH_KY: number;
                DOT_XUAT: number;
            };
            statusCounts: StatusCounts;
        };
        periodCounts: {
            total: number;
            periodic: number;
            statusCounts: StatusCounts;
        };
    }>;
    private taskStatus;
    private periodStatus;
    private emptyStatusCounts;
    private assertPermission;
}
export {};
