"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DRAFT_BYTES = void 0;
exports.storageRoot = storageRoot;
exports.privateUploadOptions = privateUploadOptions;
exports.asDownload = asDownload;
const node_fs_1 = require("node:fs");
const node_fs_2 = require("node:fs");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const node_stream_1 = require("node:stream");
const common_1 = require("@nestjs/common");
exports.MAX_DRAFT_BYTES = 200 * 1024 * 1024;
function storageRoot(value = process.env.STORAGE_PATH) {
    return (0, node_path_1.resolve)(value ?? (0, node_path_1.join)(process.cwd(), 'storage'));
}
class PrivateStorage {
    _handleFile(_request, file, callback) {
        const root = storageRoot();
        (0, node_fs_1.mkdirSync)(root, { recursive: true });
        const filename = (0, node_crypto_1.randomUUID)();
        const path = (0, node_path_1.join)(root, filename);
        let size = 0;
        file.stream.on('data', (chunk) => {
            size += chunk.length;
        });
        (0, node_stream_1.pipeline)(file.stream, (0, node_fs_2.createWriteStream)(path), (error) => {
            if (error)
                return callback(error);
            callback(null, { destination: root, filename, path, size });
        });
    }
    _removeFile(_request, file, callback) {
        if (!file.path)
            return callback(null);
        void import('node:fs/promises')
            .then(({ unlink }) => unlink(file.path))
            .then(() => callback(null))
            .catch((error) => callback(error.code === 'ENOENT' ? null : error));
    }
}
function privateUploadOptions() {
    return {
        limits: { fileSize: exports.MAX_DRAFT_BYTES, files: 1 },
        storage: new PrivateStorage(),
    };
}
function asDownload(file) {
    return new common_1.StreamableFile(file.stream, {
        type: file.mimeType,
        length: file.sizeBytes,
        disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    });
}
//# sourceMappingURL=private-storage.js.map