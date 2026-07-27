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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const core_1 = require("@nestjs/core");
const env_1 = require("../config/env");
const public_decorator_1 = require("../decorators/public.decorator");
let JwtAuthGuard = class JwtAuthGuard {
    reflector;
    jwtService;
    constructor(reflector, jwtService) {
        this.reflector = reflector;
        this.jwtService = jwtService;
    }
    async canActivate(context) {
        if (this.reflector.getAllAndOverride(public_decorator_1.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ])) {
            return true;
        }
        const request = context
            .switchToHttp()
            .getRequest();
        const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
        if (scheme !== 'Bearer' || !token)
            throw this.unauthorized();
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: (0, env_1.env)(process.env).jwtSecret,
                algorithms: ['HS256'],
                issuer: 'congan-api',
                audience: 'congan-web',
            });
            if (!this.isAccessTokenPayload(payload))
                throw this.unauthorized();
            request.user = payload;
            return true;
        }
        catch {
            throw this.unauthorized();
        }
    }
    isAccessTokenPayload(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const payload = value;
        return (Number.isInteger(payload.sub) &&
            Number.isInteger(payload.organizationId) &&
            typeof payload.iat === 'number' &&
            Number.isFinite(payload.iat) &&
            typeof payload.exp === 'number' &&
            Number.isFinite(payload.exp) &&
            typeof payload.username === 'string' &&
            Array.isArray(payload.permissions) &&
            payload.permissions.every((permission) => typeof permission === 'string'));
    }
    unauthorized() {
        return new common_1.HttpException({ errorCode: 'UNAUTHORIZED', message: 'Authentication required' }, common_1.HttpStatus.UNAUTHORIZED);
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        jwt_1.JwtService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map