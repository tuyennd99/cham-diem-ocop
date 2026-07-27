import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EffectivePermissions, SystemRepository } from '../repositories/system.repository';
export declare class PermissionGuard implements CanActivate {
    private readonly reflector;
    private readonly repository;
    constructor(reflector: Reflector, repository: SystemRepository);
    canActivate(context: ExecutionContext): Promise<boolean>;
    assertPermissions(principal: EffectivePermissions | null, required: string[]): void;
}
