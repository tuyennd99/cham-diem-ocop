import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthResult, RequestMeta } from '../types/auth';
export declare class AuthService {
    private readonly repository;
    private readonly jwtService;
    private readonly configService;
    constructor(repository: AuthRepository, jwtService: JwtService, configService: ConfigService);
    login(username: string, password: string, meta: RequestMeta): Promise<AuthResult>;
    refresh(rawRefreshToken: string, csrfToken: string, meta: RequestMeta): Promise<AuthResult>;
    logout(rawRefreshToken: string | undefined, csrfToken: string, meta: RequestMeta): Promise<void>;
    profile(userId: number): Promise<{
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
    changePassword(userId: number, currentPassword: string, newPassword: string, meta: RequestMeta): Promise<void>;
    createCsrfToken(): string;
    assertCsrfToken(token: string): void;
    private ensureAccountAvailable;
    private handleFailedLogin;
    private buildAuthResult;
    private publicUser;
    private hashRefreshToken;
    private signCsrf;
    private csrfSecret;
    private jwtSecret;
    private unauthorized;
    private locked;
    private csrfError;
}
