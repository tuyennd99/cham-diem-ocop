"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
let ApiExceptionFilter = class ApiExceptionFilter {
    catch(exception, host) {
        const context = host.switchToHttp();
        const response = context.getResponse();
        const request = context.getRequest();
        const status = exception instanceof common_1.HttpException
            ? exception.getStatus()
            : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        const exceptionResponse = exception instanceof common_1.HttpException ? exception.getResponse() : undefined;
        const body = typeof exceptionResponse === 'object' && exceptionResponse !== null
            ? exceptionResponse
            : {};
        const message = typeof exceptionResponse === 'string'
            ? exceptionResponse
            : Array.isArray(body.message)
                ? body.message.join(', ')
                : typeof body.message === 'string'
                    ? body.message
                    : status === common_1.HttpStatus.INTERNAL_SERVER_ERROR
                        ? 'Internal server error'
                        : 'Request failed';
        const errorCode = typeof body.errorCode === 'string'
            ? body.errorCode
            : status === common_1.HttpStatus.BAD_REQUEST
                ? 'VALIDATION_ERROR'
                : status === common_1.HttpStatus.INTERNAL_SERVER_ERROR
                    ? 'INTERNAL_SERVER_ERROR'
                    : `HTTP_${status}`;
        const suppliedRequestId = request.header('x-request-id');
        const requestId = suppliedRequestId && /^[A-Za-z0-9._-]{1,100}$/.test(suppliedRequestId)
            ? suppliedRequestId
            : (0, node_crypto_1.randomUUID)();
        const payload = {
            statusCode: status,
            errorCode,
            message,
            requestId,
            ...(body.details === undefined ? {} : { details: body.details }),
        };
        response.status(status).json(payload);
    }
};
exports.ApiExceptionFilter = ApiExceptionFilter;
exports.ApiExceptionFilter = ApiExceptionFilter = __decorate([
    (0, common_1.Catch)()
], ApiExceptionFilter);
//# sourceMappingURL=api-exception.filter.js.map