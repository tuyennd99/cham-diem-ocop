import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from '../dtos/tasks.dto';
import { TasksRepository, TaskView } from '../repositories/tasks.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { NotificationsService } from './notifications.service';
export declare class TasksService {
    private readonly repository;
    private readonly notificationsService?;
    private readonly logger;
    constructor(repository: TasksRepository, notificationsService?: NotificationsService | undefined);
    list(query: TaskQueryDto, principal: AccessTokenPayload): Promise<{
        data: TaskView[];
        meta: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
    }>;
    get(id: number, principal: AccessTokenPayload): Promise<TaskView>;
    listOrganizationLookups(principal: AccessTokenPayload): import("@prisma/client").Prisma.PrismaPromise<{
        id: number;
        code: string;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
    }[]>;
    listProgramLookups(principal: AccessTokenPayload): import("@prisma/client").Prisma.PrismaPromise<{
        id: number;
        code: string;
        name: string;
        status: string;
        description: string | null;
    }[]>;
    create(input: CreateTaskDto, principal: AccessTokenPayload, meta?: RequestMeta): Promise<TaskView>;
    update(id: number, input: UpdateTaskDto, principal: AccessTokenPayload, meta?: RequestMeta): Promise<TaskView>;
    remove(id: number, principal: AccessTokenPayload, meta?: RequestMeta): Promise<TaskView>;
    close(id: number, reason: string, principal: AccessTokenPayload, meta?: RequestMeta): Promise<TaskView>;
    private requireTask;
    private validate;
    private validateTypeFields;
    private normalize;
    private requiredText;
    private hasGlobalScope;
    private assertPermission;
    private assertAssigningOrganization;
    private assertStaffAssignment;
    private rethrowUniqueCode;
    private notifyAssignment;
    private safeNotify;
}
