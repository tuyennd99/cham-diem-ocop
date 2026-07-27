"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureApp = configureApp;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const api_exception_filter_1 = require("../filters/api-exception.filter");
const api_response_interceptor_1 = require("../interceptors/api-response.interceptor");
const env_1 = require("./env");
function configureApp(app) {
    const { allowedOrigins, trustProxyHops } = (0, env_1.env)(process.env);
    if (trustProxyHops > 0) {
        const express = app.getHttpAdapter().getInstance();
        express.set('trust proxy', trustProxyHops);
    }
    app.setGlobalPrefix('api/v1');
    app.use((0, helmet_1.default)());
    app.use((0, cookie_parser_1.default)());
    app.enableCors({ origin: allowedOrigins, credentials: true });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new api_exception_filter_1.ApiExceptionFilter());
    app.useGlobalInterceptors(new api_response_interceptor_1.ApiResponseInterceptor());
    const document = swagger_1.SwaggerModule.createDocument(app, new swagger_1.DocumentBuilder().setTitle('Cong An API').setVersion('v1').build());
    swagger_1.SwaggerModule.setup('api/docs', app, document);
}
//# sourceMappingURL=app.js.map