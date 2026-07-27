import type { Request } from 'express';
import { CreateOrganizationDto, CreatePermissionGroupDto, CreateProgramDto, CreateUserDto, LockUserDto, ResetPasswordDto, UpdateOrganizationDto, UpdatePermissionGroupDto, UpdateProgramDto, UpdateUserDto } from '../dtos/system.dto';
import { SystemService } from '../services/system.service';
import type { AccessTokenPayload } from '../types/auth';
export declare class SystemController {
    private readonly service;
    constructor(service: SystemService);
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
    createUser(body: CreateUserDto, actor: AccessTokenPayload, request: Request): Promise<Omit<{
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
    updateUser(id: number, body: UpdateUserDto, actor: AccessTokenPayload, request: Request): Promise<Omit<{
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
    deleteUser(id: number, actor: AccessTokenPayload, request: Request): Promise<{
        success: boolean;
    }>;
    lockUser(id: number, body: LockUserDto, actor: AccessTokenPayload, request: Request): Promise<Omit<{
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
    unlockUser(id: number, actor: AccessTokenPayload, request: Request): Promise<Omit<{
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
    resetUserPassword(id: number, body: ResetPasswordDto, actor: AccessTokenPayload, request: Request): Promise<{
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
    createOrganization(body: CreateOrganizationDto, actor: AccessTokenPayload, request: Request): Promise<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateOrganization(id: number, body: UpdateOrganizationDto, actor: AccessTokenPayload, request: Request): Promise<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    deleteOrganization(id: number, actor: AccessTokenPayload, request: Request): Promise<{
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
    createProgram(body: CreateProgramDto, actor: AccessTokenPayload, request: Request): Promise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    updateProgram(id: number, body: UpdateProgramDto, actor: AccessTokenPayload, request: Request): Promise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    deleteProgram(id: number, actor: AccessTokenPayload, request: Request): Promise<{
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
    createPermissionGroup(body: CreatePermissionGroupDto, actor: AccessTokenPayload, request: Request): Promise<{
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
    updatePermissionGroup(id: number, body: UpdatePermissionGroupDto, actor: AccessTokenPayload, request: Request): Promise<{
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
    deletePermissionGroup(id: number, actor: AccessTokenPayload, request: Request): Promise<{
        success: boolean;
    }>;
    listPermissions(): import("@prisma/client").Prisma.PrismaPromise<{
        code: string;
        id: number;
        name: string;
        description: string | null;
    }[]>;
    private requestMeta;
}
