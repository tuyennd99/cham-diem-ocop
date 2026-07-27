"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponseInterceptor = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
let ApiResponseInterceptor = class ApiResponseInterceptor {
    intercept(context, next) {
        return next.handle().pipe((0, rxjs_1.map)((data) => {
            if (data instanceof common_1.StreamableFile) {
                return data;
            }
            const statusCode = context
                .switchToHttp()
                .getResponse().statusCode;
            if (this.isPaginated(data)) {
                return {
                    statusCode,
                    data: data.data,
                    meta: data.meta,
                };
            }
            return { statusCode, data };
        }));
    }
    isPaginated(value) {
        if (typeof value !== 'object' || value === null)
            return false;
        const candidate = value;
        const meta = candidate.meta;
        return ('data' in candidate &&
            typeof meta === 'object' &&
            meta !== null &&
            ['page', 'limit', 'total', 'totalPages'].every((key) => typeof meta[key] === 'number'));
    }
};
exports.ApiResponseInterceptor = ApiResponseInterceptor;
exports.ApiResponseInterceptor = ApiResponseInterceptor = __decorate([
    (0, common_1.Injectable)()
], ApiResponseInterceptor);
//# sourceMappingURL=api-response.interceptor.js.map