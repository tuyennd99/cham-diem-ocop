import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, RefreshSession, RequestMeta } from '../types/auth';
export declare class AuthRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findUserByUsername(username: string): Promise<AuthUser | null>;
    findUserById(id: number): Promise<AuthUser | null>;
    recordUnknownLoginFailure(username: string, meta: RequestMeta): Promise<void>;
    registerFailedLogin(userId: number, now: Date, meta: RequestMeta): Promise<{
        locked: boolean;
        lockedUntil: Date | null;
    }>;
    unlockAutomatically(userId: number, expectedLockedUntil: Date, now: Date, meta: RequestMeta): Promise<boolean>;
    completeLogin(userId: number, expectedPasswordHash: string, tokenHash: string, expiresAt: Date, now: Date, meta: RequestMeta): Promise<boolean>;
    findSessionByHash(tokenHash: string): Promise<RefreshSession | null>;
    rotateSession(sessionId: number, userId: number, tokenHash: string, expiresAt: Date, now: Date, meta: RequestMeta): Promise<boolean>;
    revokeSession(sessionId: number, userId: number, now: Date, reason: string, meta: RequestMeta): Promise<void>;
    revokeAllSessions(userId: number, now: Date, reason: string, meta: RequestMeta): Promise<void>;
    changePassword(userId: number, expectedPasswordHash: string, newPasswordHash: string, now: Date, meta: RequestMeta): Promise<boolean>;
    private toAuthUser;
    private auditMeta;
}
