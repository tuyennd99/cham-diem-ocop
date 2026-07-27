import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';
export interface EffectivePermissions {
    status: 'ACTIVE' | 'LOCKED';
    isAdmin: boolean;
    isStaff: boolean;
    organizationId: number;
    permissions: string[];
}
interface CreateUserData {
    username: string;
    fullName: string;
    position?: string;
    rank?: string;
    phone?: string;
    passwordHash: string;
    organizationId: number;
    permissionGroupIds: number[];
}
interface UpdateUserData {
    username?: string;
    fullName?: string;
    position?: string;
    rank?: string;
    phone?: string;
    organizationId?: number;
    permissionGroupIds?: number[];
}
interface OrganizationData {
    code?: string;
    name?: string;
    isAssigningAuthority?: boolean;
    isExecutingUnit?: boolean;
    status?: string;
}
interface ProgramData {
    code?: string;
    name?: string;
    description?: string;
    status?: string;
}
interface PermissionGroupData {
    code?: string;
    name?: string;
    description?: string;
    permissionIds?: number[];
}
export declare class SystemRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listEffectivePermissions(userId: number): Promise<EffectivePermissions | null>;
    listUsers(): Prisma.PrismaPromise<{
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
    }[]>;
    findUserById(id: number): Prisma.Prisma__UserClient<{
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
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    findUserByUsername(username: string): Prisma.Prisma__UserClient<{
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
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    createUser(data: CreateUserData, actorId: number, meta: RequestMeta): Promise<{
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
    }>;
    updateUser(id: number, data: UpdateUserData, actorId: number, meta: RequestMeta): Promise<{
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
    }>;
    deleteUser(id: number, actorId: number, now: Date, meta: RequestMeta): Promise<void>;
    lockUser(id: number, actorId: number, reason: string, now: Date, meta: RequestMeta): Promise<{
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
    }>;
    unlockUser(id: number, actorId: number, now: Date, meta: RequestMeta): Promise<{
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
    }>;
    resetUserPassword(id: number, actorId: number, passwordHash: string, now: Date, meta: RequestMeta): Promise<void>;
    listOrganizations(): Prisma.PrismaPromise<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOrganizationById(id: number): Prisma.Prisma__OrganizationClient<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    findOrganizationByCode(code: string): Prisma.Prisma__OrganizationClient<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    createOrganization(data: Required<Pick<OrganizationData, 'code' | 'name'>> & OrganizationData, actorId: number, meta: RequestMeta): Promise<{
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    updateOrganization(id: number, data: OrganizationData, actorId: number, meta: RequestMeta): Promise<{
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
        code: string;
        id: number;
        name: string;
        isAssigningAuthority: boolean;
        isExecutingUnit: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listPrograms(): Prisma.PrismaPromise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }[]>;
    findProgramById(id: number): Prisma.Prisma__ProgramClient<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    findProgramByCode(code: string): Prisma.Prisma__ProgramClient<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs, Prisma.PrismaClientOptions>;
    createProgram(data: Required<Pick<ProgramData, 'code' | 'name'>> & ProgramData, actorId: number, meta: RequestMeta): Promise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    updateProgram(id: number, data: ProgramData, actorId: number, meta: RequestMeta): Promise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    deleteProgram(id: number, actorId: number, meta: RequestMeta): Promise<{
        code: string;
        id: number;
        name: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
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
    findPermissionGroupById(id: number): Promise<{
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
    } | null>;
    findPermissionGroupByCode(code: string): Promise<{
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
    } | null>;
    findPermissionGroupsByIds(ids: number[]): Prisma.PrismaPromise<{
        id: number;
    }[]>;
    findPermissionsByIds(ids: number[]): Prisma.PrismaPromise<{
        id: number;
    }[]>;
    createPermissionGroup(data: Required<Pick<PermissionGroupData, 'code' | 'name' | 'permissionIds'>> & PermissionGroupData, actorId: number, meta: RequestMeta): Promise<{
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
    updatePermissionGroup(id: number, data: PermissionGroupData, actorId: number, meta: RequestMeta): Promise<{
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
        code: string;
        id: number;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
    }>;
    listPermissions(): Prisma.PrismaPromise<{
        code: string;
        id: number;
        name: string;
        description: string | null;
    }[]>;
    private revokeSessions;
    private createAudited;
    private updateAudited;
    private deleteAudited;
    private writeAudit;
    private toPermissionGroup;
    private userAudit;
    private auditMeta;
}
export {};
