"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestMeta = requestMeta;
const node_crypto_1 = require("node:crypto");
function requestMeta(request) {
    const requestId = request.headers['x-request-id'];
    return {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        requestId: typeof requestId === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(requestId)
            ? requestId
            : (0, node_crypto_1.randomUUID)(),
    };
}
//# sourceMappingURL=request-meta.js.map