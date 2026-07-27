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
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const audit_repository_1 = require("../repositories/audit.repository");
const SECRET_FIELD = /password|passcode|token|cookie|secret|authorization|storageKey|checksum|binary|dataUrl|buffer/i;
let AuditService = class AuditService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    append(input) {
        const { beforeData, afterData, ...fields } = input;
        return this.repository.append({
            ...fields,
            ...(beforeData === undefined
                ? {}
                : { beforeData: this.sanitizeJson(beforeData) ?? null }),
            ...(afterData === undefined
                ? {}
                : { afterData: this.sanitizeJson(afterData) ?? null }),
        });
    }
    async list(filters, principal) {
        if (!principal.isAdmin && !principal.permissions.includes('audit.read')) {
            throw new common_1.ForbiddenException('audit.read is required');
        }
        const { data, total } = await this.repository.list(filters);
        return {
            data: data.map((row) => ({
                ...row,
                beforeData: this.sanitizeJson(row.beforeData) ?? null,
                afterData: this.sanitizeJson(row.afterData) ?? null,
            })),
            meta: {
                page: filters.page,
                limit: filters.limit,
                total,
                totalPages: Math.ceil(total / filters.limit),
            },
        };
    }
    sanitizeJson(value) {
        if (value === null)
            return undefined;
        if (typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean') {
            return value;
        }
        if (value instanceof Date)
            return value.toISOString();
        if (Array.isArray(value)) {
            return value
                .map((item) => this.sanitizeJson(item))
                .filter((item) => item !== undefined);
        }
        if (typeof value === 'object') {
            const sanitized = {};
            for (const [key, item] of Object.entries(value)) {
                if (SECRET_FIELD.test(key))
                    continue;
                const safe = this.sanitizeJson(item);
                if (safe !== undefined)
                    sanitized[key] = safe;
            }
            return sanitized;
        }
        return undefined;
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_repository_1.AuditRepository])
], AuditService);
//# sourceMappingURL=audit.service.js.map