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
exports.CsrfGuard = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const env_1 = require("../config/env");
const auth_service_1 = require("../services/auth.service");
let CsrfGuard = class CsrfGuard {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const origin = request.headers.origin;
        if (!origin || !(0, env_1.env)(process.env).allowedOrigins.includes(origin)) {
            throw this.forbidden('Origin is not allowed');
        }
        const header = request.headers['x-csrf-token'];
        const cookies = request.cookies;
        const cookie = typeof cookies === 'object' && cookies !== null
            ? cookies.csrf_token
            : undefined;
        if (typeof header !== 'string' ||
            typeof cookie !== 'string' ||
            !this.equal(header, cookie)) {
            throw this.forbidden('Invalid CSRF token');
        }
        this.authService.assertCsrfToken(header);
        return true;
    }
    equal(left, right) {
        const leftBuffer = Buffer.from(left);
        const rightBuffer = Buffer.from(right);
        return (leftBuffer.length === rightBuffer.length &&
            (0, node_crypto_1.timingSafeEqual)(leftBuffer, rightBuffer));
    }
    forbidden(message) {
        return new common_1.HttpException({ errorCode: 'CSRF_INVALID', message }, common_1.HttpStatus.FORBIDDEN);
    }
};
exports.CsrfGuard = CsrfGuard;
exports.CsrfGuard = CsrfGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], CsrfGuard);
//# sourceMappingURL=csrf.guard.js.map