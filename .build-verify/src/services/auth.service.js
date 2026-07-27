"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const node_crypto_1 = require("node:crypto");
const password_1 = require("../../prisma/password");
const env_1 = require("../config/env");
const auth_repository_1 = require("../repositories/auth.repository");
const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_LIFETIME_MS = 3 * 24 * 60 * 60_000;
const DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=4$+V/bhD/sS9k7L7dE3QRhBw$hdZ3VKkQ7UjdKulRRi9TNLfCzTXEcLrHeiwzYScJFBQ';
let AuthService = class AuthService {
    repository;
    jwtService;
    configService;
    constructor(repository, jwtService, configService) {
        this.repository = repository;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async login(username, password, meta) {
        const now = new Date();
        const user = await this.repository.findUserByUsername(username.trim());
        if (!user) {
            await (0, password_1.verifyPassword)(DUMMY_PASSWORD_HASH, password);
            await this.repository.recordUnknownLoginFailure(username.trim(), meta);
            throw this.unauthorized();
        }
        await this.ensureAccountAvailable(user, now, meta);
        if (!(await (0, password_1.verifyPassword)(user.passwordHash, password))) {
            await this.handleFailedLogin(user, meta);
        }
        const refreshExpiresAt = new Date(now.getTime() + REFRESH_LIFETIME_MS);
        const refreshToken = (0, node_crypto_1.randomBytes)(32).toString('base64url');
        const completed = await this.repository.completeLogin(user.id, user.passwordHash, this.hashRefreshToken(refreshToken), refreshExpiresAt, now, meta);
        if (!completed)
            throw this.unauthorized();
        return this.buildAuthResult(user, refreshToken, refreshExpiresAt);
    }
    async refresh(rawRefreshToken, csrfToken, meta) {
        this.assertCsrfToken(csrfToken);
        const now = new Date();
        const session = await this.repository.findSessionByHash(this.hashRefreshToken(rawRefreshToken));
        if (!session)
            throw this.unauthorized('Invalid refresh token');
        if (session.revokedAt) {
            await this.repository.revokeAllSessions(session.user.id, now, 'REFRESH_TOKEN_REUSE', meta);
            throw this.unauthorized('Invalid refresh token');
        }
        if (session.expiresAt <= now) {
            await this.repository.revokeSession(session.id, session.user.id, now, 'REFRESH_EXPIRED', meta);
            throw this.unauthorized('Refresh token expired');
        }
        if (session.user.status !== 'ACTIVE' || session.user.deletedAt != null) {
            await this.repository.revokeAllSessions(session.user.id, now, 'ACCOUNT_UNAVAILABLE', meta);
            throw this.locked();
        }
        const refreshToken = (0, node_crypto_1.randomBytes)(32).toString('base64url');
        const rotated = await this.repository.rotateSession(session.id, session.user.id, this.hashRefreshToken(refreshToken), session.expiresAt, now, meta);
        if (!rotated) {
            await this.repository.revokeAllSessions(session.user.id, now, 'REFRESH_TOKEN_REUSE', meta);
            throw this.unauthorized('Invalid refresh token');
        }
        return this.buildAuthResult(session.user, refreshToken, session.expiresAt);
    }
    async logout(rawRefreshToken, csrfToken, meta) {
        this.assertCsrfToken(csrfToken);
        if (!rawRefreshToken)
            return;
        const session = await this.repository.findSessionByHash(this.hashRefreshToken(rawRefreshToken));
        if (session) {
            await this.repository.revokeSession(session.id, session.user.id, new Date(), 'LOGOUT', meta);
        }
    }
    async profile(userId) {
        const user = await this.repository.findUserById(userId);
        if (!user || user.status !== 'ACTIVE')
            throw this.unauthorized();
        return this.publicUser(user);
    }
    async changePassword(userId, currentPassword, newPassword, meta) {
        const user = await this.repository.findUserById(userId);
        if (!user || user.status !== 'ACTIVE')
            throw this.unauthorized();
        if (!(await (0, password_1.verifyPassword)(user.passwordHash, currentPassword))) {
            throw this.unauthorized('Current password is incorrect');
        }
        const changed = await this.repository.changePassword(user.id, user.passwordHash, await (0, password_1.hashPassword)(newPassword), new Date(), meta);
        if (changed === false)
            throw this.unauthorized();
    }
    createCsrfToken() {
        const value = (0, node_crypto_1.randomBytes)(32).toString('base64url');
        return `${value}.${this.signCsrf(value)}`;
    }
    assertCsrfToken(token) {
        const separator = token.lastIndexOf('.');
        if (separator < 1)
            throw this.csrfError();
        const value = token.slice(0, separator);
        const signature = token.slice(separator + 1);
        const expected = this.signCsrf(value);
        const actualBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expected);
        if (actualBuffer.length !== expectedBuffer.length ||
            !(0, node_crypto_1.timingSafeEqual)(actualBuffer, expectedBuffer)) {
            throw this.csrfError();
        }
    }
    async ensureAccountAvailable(user, now, meta) {
        if (user.status !== 'LOCKED')
            return;
        if (!user.lockedUntil || user.lockedUntil > now)
            throw this.locked();
        await this.repository.unlockAutomatically(user.id, user.lockedUntil, now, meta);
        user.status = 'ACTIVE';
        user.lockedUntil = null;
        user.failedLoginCount = 0;
        user.failedLoginWindowStartedAt = null;
    }
    async handleFailedLogin(user, meta) {
        const now = new Date();
        const { locked } = await this.repository.registerFailedLogin(user.id, now, meta);
        if (locked)
            throw this.locked();
        throw this.unauthorized();
    }
    async buildAuthResult(user, refreshToken, refreshExpiresAt) {
        const payload = {
            sub: user.id,
            username: user.username,
            organizationId: user.organizationId,
            permissions: user.permissions,
            isAdmin: Boolean(user.isAdmin),
            isStaff: Boolean(user.isStaff),
        };
        return {
            accessToken: await this.jwtService.signAsync(payload, {
                secret: this.jwtSecret(),
                algorithm: 'HS256',
                issuer: 'congan-api',
                audience: 'congan-web',
                expiresIn: '15m',
            }),
            expiresIn: ACCESS_TOKEN_SECONDS,
            refreshToken,
            refreshExpiresAt,
            csrfToken: this.createCsrfToken(),
            user: this.publicUser(user),
        };
    }
    publicUser(user) {
        return {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            position: user.position,
            rank: user.rank,
            phone: user.phone,
            organizationId: user.organizationId,
            organization: user.organization,
            permissions: user.permissions,
            isAdmin: Boolean(user.isAdmin),
            isStaff: Boolean(user.isStaff),
        };
    }
    hashRefreshToken(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    signCsrf(value) {
        return (0, node_crypto_1.createHmac)('sha256', this.csrfSecret())
            .update(value)
            .digest('base64url');
    }
    csrfSecret() {
        return (0, env_1.requireSecret)('CSRF_SECRET', this.configService.get('CSRF_SECRET'));
    }
    jwtSecret() {
        return (0, env_1.requireSecret)('JWT_SECRET', this.configService.get('JWT_SECRET'));
    }
    unauthorized(message = 'Invalid username or password') {
        return new common_1.HttpException({ errorCode: 'INVALID_CREDENTIALS', message }, common_1.HttpStatus.UNAUTHORIZED);
    }
    locked() {
        return new common_1.HttpException({ errorCode: 'ACCOUNT_LOCKED', message: 'Account is locked' }, 423);
    }
    csrfError() {
        return new common_1.HttpException({ errorCode: 'CSRF_INVALID', message: 'Invalid CSRF token' }, common_1.HttpStatus.FORBIDDEN);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_repository_1.AuthRepository,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map