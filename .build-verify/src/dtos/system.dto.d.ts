export declare class CreateUserDto {
    username: string;
    fullName: string;
    position?: string;
    rank?: string;
    phone?: string;
    password: string;
    organizationId: number;
    permissionGroupIds: number[];
}
export declare class UpdateUserDto {
    username?: string;
    fullName?: string;
    position?: string;
    rank?: string;
    phone?: string;
    organizationId?: number;
    permissionGroupIds?: number[];
}
export declare class LockUserDto {
    reason: string;
}
export declare class ResetPasswordDto {
    password: string;
}
export declare class CreateOrganizationDto {
    code: string;
    name: string;
    isAssigningAuthority?: boolean;
    isExecutingUnit?: boolean;
    status?: 'ACTIVE' | 'INACTIVE';
}
declare const UpdateOrganizationDto_base: import("@nestjs/common").Type<Partial<CreateOrganizationDto>>;
export declare class UpdateOrganizationDto extends UpdateOrganizationDto_base {
}
export declare class CreateProgramDto {
    code: string;
    name: string;
    description?: string;
    status?: 'ACTIVE' | 'INACTIVE';
}
declare const UpdateProgramDto_base: import("@nestjs/common").Type<Partial<CreateProgramDto>>;
export declare class UpdateProgramDto extends UpdateProgramDto_base {
}
export declare class CreatePermissionGroupDto {
    code: string;
    name: string;
    description?: string;
    permissionIds: number[];
}
declare const UpdatePermissionGroupDto_base: import("@nestjs/common").Type<Partial<CreatePermissionGroupDto>>;
export declare class UpdatePermissionGroupDto extends UpdatePermissionGroupDto_base {
}
export {};
