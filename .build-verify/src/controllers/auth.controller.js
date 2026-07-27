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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const current_user_decorator_1 = require("../decorators/current-user.decorator");
const public_decorator_1 = require("../decorators/public.decorator");
const auth_dto_1 = require("../dtos/auth.dto");
const csrf_guard_1 = require("../guards/csrf.guard");
const auth_service_1 = require("../services/auth.service");
const REFRESH_MAX_AGE_MS = 3 * 24 * 60 * 60_000;
const REFRESH_COOKIE_PATH = '/api/v1/auth';
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async login(body, request, response) {
        const result = await this.authService.login(body.username, body.password, this.requestMeta(request));
        this.setAuthCookies(response, result);
        return this.publicResult(result);
    }
    async refresh(csrfToken, request, response) {
        const result = await this.authService.refresh(this.cookie(request, 'refresh_token') ?? '', csrfToken, this.requestMeta(request));
        this.setAuthCookies(response, result);
        return this.publicResult(result);
    }
    async logout(csrfToken, request, response) {
        await this.authService.logout(this.cookie(request, 'refresh_token'), csrfToken, this.requestMeta(request));
        this.clearAuthCookies(response);
        return { success: true };
    }
    profile(user) {
        return this.authService.profile(user.sub);
    }
    async changePassword(user, body, request) {
        await this.authService.changePassword(user.sub, body.currentPassword, body.newPassword, this.requestMeta(request));
        return { success: true };
    }
    setAuthCookies(response, result) {
        const options = {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: Math.min(REFRESH_MAX_AGE_MS, Math.max(0, result.refreshExpiresAt.getTime() - Date.now())),
        };
        response.cookie('refresh_token', result.refreshToken, {
            ...options,
            httpOnly: true,
            path: REFRESH_COOKIE_PATH,
        });
        response.cookie('csrf_token', result.csrfToken, {
            ...options,
            httpOnly: false,
            path: '/',
        });
    }
    clearAuthCookies(response) {
        const options = {
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        };
        response.clearCookie('refresh_token', {
            ...options,
            httpOnly: true,
            path: REFRESH_COOKIE_PATH,
        });
        response.clearCookie('csrf_token', {
            ...options,
            httpOnly: false,
            path: '/',
        });
    }
    publicResult({ accessToken, expiresIn, user }) {
        return { accessToken, expiresIn, user };
    }
    cookie(request, name) {
        const cookies = request.cookies;
        const value = typeof cookies === 'object' && cookies !== null
            ? cookies[name]
            : undefined;
        return typeof value === 'string' ? value : undefined;
    }
    requestMeta(request) {
        const requestId = request.headers['x-request-id'];
        return {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: typeof requestId === 'string' &&
                /^[A-Za-z0-9._-]{1,100}$/.test(requestId)
                ? requestId
                : undefined,
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(200),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(csrf_guard_1.CsrfGuard),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, common_1.Headers)('x-csrf-token')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(csrf_guard_1.CsrfGuard),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60_000 } }),
    __param(0, (0, common_1.Headers)('x-csrf-token')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "profile", null);
__decorate([
    (0, common_1.Patch)('change-password'),
    (0, common_1.HttpCode)(200),
    (0, swagger_1.ApiBearerAuth)(),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auth_dto_1.ChangePasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Authentication'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map