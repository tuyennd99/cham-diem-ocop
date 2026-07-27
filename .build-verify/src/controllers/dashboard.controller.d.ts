import { DashboardQueryDto } from '../dtos/observability.dto';
import { DashboardService } from '../services/dashboard.service';
import type { AccessTokenPayload } from '../types/auth';
export declare class DashboardController {
    private readonly service;
    constructor(service: DashboardService);
    summary(query: DashboardQueryDto, principal: AccessTokenPayload): Promise<{
        totalTasks: number;
        taskCounts: {
            total: number;
            typeCounts: {
                DINH_KY: number;
                DOT_XUAT: number;
            };
            statusCounts: {
                QUA_HAN: number;
                SAP_DEN_HAN: number;
                HOAN_THANH: number;
                DANG_CAP_NHAT: number;
                CHUA_HOAN_THANH: number;
            };
        };
        periodCounts: {
            total: number;
            periodic: number;
            statusCounts: {
                QUA_HAN: number;
                SAP_DEN_HAN: number;
                HOAN_THANH: number;
                DANG_CAP_NHAT: number;
                CHUA_HOAN_THANH: number;
            };
        };
    }>;
    statistics(query: DashboardQueryDto, principal: AccessTokenPayload): Promise<{
        totalTasks: number;
        taskCounts: {
            total: number;
            typeCounts: {
                DINH_KY: number;
                DOT_XUAT: number;
            };
            statusCounts: {
                QUA_HAN: number;
                SAP_DEN_HAN: number;
                HOAN_THANH: number;
                DANG_CAP_NHAT: number;
                CHUA_HOAN_THANH: number;
            };
        };
        periodCounts: {
            total: number;
            periodic: number;
            statusCounts: {
                QUA_HAN: number;
                SAP_DEN_HAN: number;
                HOAN_THANH: number;
                DANG_CAP_NHAT: number;
                CHUA_HOAN_THANH: number;
            };
        };
    }>;
}
