import type { Request, Response } from 'express';
import { ChangePasswordDto, LoginDto } from '../dtos/auth.dto';
import { AuthService } from '../services/auth.service';
import type { AccessTokenPayload } from '../types/auth';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(body: LoginDto, request: Request, response: Response): Promise<{
        accessToken: string;
        expiresIn: number;
        user: Omit<import("../types/auth").AuthUser, "status" | "passwordHash" | "lockedUntil" | "failedLoginCount" | "failedLoginWindowStartedAt" | "deletedAt">;
    }>;
    refresh(csrfToken: string, request: Request & {
        cookies?: Record<string, unknown>;
    }, response: Response): Promise<{
        accessToken: string;
        expiresIn: number;
        user: Omit<import("../types/auth").AuthUser, "status" | "passwordHash" | "lockedUntil" | "failedLoginCount" | "failedLoginWindowStartedAt" | "deletedAt">;
    }>;
    logout(csrfToken: string, request: Request & {
        cookies?: Record<string, unknown>;
    }, response: Response): Promise<{
        success: boolean;
    }>;
    profile(user: AccessTokenPayload): Promise<{
        id: number;
        username: string;
        fullName: string;
        position: string | null | undefined;
        rank: string | null | undefined;
        phone: string | null | undefined;
        organizationId: number;
        organization: {
            id: number;
            code: string;
            name: string;
        };
        permissions: string[];
        isAdmin: boolean;
        isStaff: boolean;
    }>;
    changePassword(user: AccessTokenPayload, body: ChangePasswordDto, request: Request): Promise<{
        success: boolean;
    }>;
    private setAuthCookies;
    private clearAuthCookies;
    private publicResult;
    private cookie;
    private requestMeta;
}
