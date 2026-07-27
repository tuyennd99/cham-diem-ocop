import { CreateOrganizationDto, CreatePermissionGroupDto, CreateProgramDto, CreateUserDto, UpdateOrganizationDto, UpdatePermissionGroupDto, UpdateProgramDto, UpdateUserDto } from '../dtos/system.dto';
import { SystemRepository } from '../repositories/system.repository';
import { RequestMeta } from '../types/auth';
export declare class SystemService {
    private readonly repository;
    constructor(repository: SystemRepository);
    listUsers(): Promise<Omit<{
        id: number;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
        organization: {
            code: string;
            id: number;
            name: string;
        };
        username: string;
        fullName: string;
        position: string | null;
        rank: string | null;
        phone: string | null;
        organizationId: number;
        permissionGroups: {
            permissionGroup: {
                code: string;
                id: number;
                name: string;
            };
        }[];
    }, "passwordHash" | "lockedAt" | "lockedUntil" | "lockReason" | "failedLoginCount" | "failedLoginWindowStartedAt" | "deletedAt" | "refreshSessions">[]>;
    getUser(id: number): Promise<Omit<{
        id: number;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
        organization: {
            code: string;
            id: number;
            name: string;
        };
        username: string;
        fullName: string;
        position: string | null;
        rank: string | null;
        phone: string | null;
        organizationId: number;
        permissionGroups: {
            permissionGroup: {
                code: string;
                id: number;
                name: string;
            };
        }[];
    }, "passwordHash" | "lockedAt" | "lockedUntil" | "lockReason" | "failedLoginCount" | "failedLoginWindowStartedAt" | "deletedAt" | "refreshSessions">>;
    createUser(input: CreateUserDto, actorId: number, meta: RequestMeta): Promise<Omit<{
        id: number;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
        organization: {
            code: string;
            id: number;
            name: string;
        };
        username: string;
        fullName: string;
        position: string | null;
        rank: string | null;
        phone: string | null;
        organizationId: number;
        permissionGroups: {
            permissionGroup: {
                code: string;
                id: number;
                name: string;
            };
        }[];
    }, "passwordHash" | "lockedAt" | "lockedUntil" | "lockReason" | "failedLoginCount" | "failedLoginWindowStartedAt" | "deletedAt" | "refreshSessions">>;
    updateUser(id: number, input: UpdateUserDto, actorId: number, meta: RequestMeta): Promise<Omit<{
        id: number;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
        organization: {
            code: string;
            id: number;
            name: string;
        };
        username: string;
        fullName: string;
        position: string | null;
        rank: string | null;
        phone: string | null;
        organizationId: number;
        permissionGroups: {
            permissionGroup: {
                code: string;
                id: number;
                name: string;
            };
        }[];
    }, "passwordHash" | "lockedAt" | "lockedUntil" | "lockReason" | "failedLoginCount" | "failedLoginWindowStartedAt" | "deletedAt" | "refreshSessions">>;
    deleteUser(id: number, actorId: number, meta: RequestMeta): Promise<{
        success: boolean;
    }>;
    lockUser(id: number, reason: string, actorId: number, meta: RequestMeta): Promise<Omit<{
        id: number;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
        organization: {
            code: string;
            id: number;
            name: string;
        };
        username: string;
        fullName: string;
        position: string | null;
        rank: string | null;
        phone: string | null;
        organizationId: number;
        permissionGroups: {
            permissionGroup: {
                code: string;
                id: number;
                name: string;
            };
        }[];
    }, "passwordHash" | "lockedAt" | "lockedUntil" | "lockReason" | "failedLoginCount" | "failedLoginWindowStartedAt" | "deletedAt" | "refreshSessions">>;
    unlockUser(id: number, actorId: number, meta: RequestMeta): Promise<Omit<{
        id: number;
        status: import("@prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
        organization: {
            code: string;
            id: number;
            name: string;
        };
        username: string;
        fullName: string;
        position: string | null;
        rank: string | null;
        phone: string | null;
        organizationId: number;
        permissionGroups: {
            permissionGroup: {
                code: string;
                id: number;
                name: string;
            };
        }[];
    }, "passwordHash" | "lockedAt" | "lockedUntil" | "lockReason" | "failedLoginCount" | "failedLoginWindowStartedAt" | "deletedAt" | "refreshSessions">>;
    resetUserPassword(id: number, password: string, actorId: number, meta: RequestMeta): Promise<{
        success: boolean;
    }>;
    listOrganizations(): import("@prisma/client").Prisma.PrismaPromise<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getOrganization(id: number): Promise<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    createOrganization(input: CreateOrganizationDto, actorId: number, meta: RequestMeta): Promise<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateOrganization(id: number, input: UpdateOrganizationDto, actorId: number, meta: RequestMeta): Promise<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteOrganization(id: number, actorId: number, meta: RequestMeta): Promise<{
        success: boolean;
    }>;
    listPrograms(): import("@prisma/client").Prisma.PrismaPromise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }[]>;
    getProgram(id: number): Promise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    createProgram(input: CreateProgramDto, actorId: number, meta: RequestMeta): Promise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    updateProgram(id: number, input: UpdateProgramDto, actorId: number, meta: RequestMeta): Promise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    deleteProgram(id: number, actorId: number, meta: RequestMeta): Promise<{
        success: boolean;
    }>;
    listPermissionGroups(): Promise<{
        permissions: {
            code: string;
            id: number;
            name: string;
            description: string | null;
        }[];
        code: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }[]>;
    getPermissionGroup(id: number): Promise<{
        permissions: {
            code: string;
            id: number;
            name: string;
            description: string | null;
        }[];
        code: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    createPermissionGroup(input: CreatePermissionGroupDto, actorId: number, meta: RequestMeta): Promise<{
        permissions: {
            code: string;
            id: number;
            name: string;
            description: string | null;
        }[];
        code: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    updatePermissionGroup(id: number, input: UpdatePermissionGroupDto, actorId: number, meta: RequestMeta): Promise<{
        permissions: {
            code: string;
            id: number;
            name: string;
            description: string | null;
        }[];
        code: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    deletePermissionGroup(id: number, actorId: number, meta: RequestMeta): Promise<{
        success: boolean;
    }>;
    listPermissions(): import("@prisma/client").Prisma.PrismaPromise<{
        code: string;
        id: number;
        name: string;
        description: string | null;
    }[]>;
    private requireOrganization;
    private requirePermissionGroups;
    private requirePermissions;
    private publicUser;
    private translate;
    private conflict;
    private notFound;
}
