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
exports.FilesService = exports.MAX_DRAFT_BYTES = void 0;
exports.assertDraftSize = assertDraftSize;
exports.assertAllowedDocument = assertAllowedDocument;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const files_repository_1 = require("../repositories/files.repository");
const private_storage_1 = require("../utils/private-storage");
Object.defineProperty(exports, "MAX_DRAFT_BYTES", { enumerable: true, get: function () { return private_storage_1.MAX_DRAFT_BYTES; } });
const documentMimes = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function assertDraftSize(sizeBytes) {
    if (sizeBytes > private_storage_1.MAX_DRAFT_BYTES) {
        throw new common_1.PayloadTooLargeException('Draft attachments exceed 200MB');
    }
}
function assertAllowedDocument(originalName, declaredMime, detectedType) {
    if (!originalName ||
        originalName !== (0, node_path_1.basename)(originalName) ||
        /[\0\r\n]/.test(originalName)) {
        throw new common_1.UnsupportedMediaTypeException('Invalid file name');
    }
    const extension = (0, node_path_1.extname)(originalName).slice(1).toLowerCase();
    if (detectedType === 'unknown' ||
        extension !== detectedType ||
        documentMimes[detectedType] !== declaredMime) {
        throw new common_1.UnsupportedMediaTypeException('File extension, MIME, and content must match');
    }
}
let FilesService = class FilesService {
    repository;
    root;
    constructor(repository, root) {
        this.repository = repository;
        this.root = (0, private_storage_1.storageRoot)(root);
    }
    async uploadDraftFile(workspaceId, file, principal, meta = {}) {
        if (!file) {
            throw new common_1.UnsupportedMediaTypeException('A document file is required');
        }
        try {
            await this.requireEditable(workspaceId, principal);
            this.assertStoredUpload(file);
            const inspected = await inspectDocument(file.path);
            assertAllowedDocument(file.originalname, file.mimetype, inspected.type);
            assertDraftSize((await this.repository.draftSize(workspaceId)) + inspected.sizeBytes);
            const stored = await this.repository.addDraftFile(workspaceId, {
                originalName: file.originalname,
                storageKey: file.filename,
                mimeType: documentMimes[inspected.type],
                sizeBytes: inspected.sizeBytes,
                checksum: inspected.checksum,
            }, principal.sub, private_storage_1.MAX_DRAFT_BYTES, { ...meta, organizationId: principal.organizationId });
            if (!stored) {
                throw new common_1.PayloadTooLargeException('Draft attachments exceed 200MB');
            }
            return stored;
        }
        catch (error) {
            await this.safeUnlink(file.path);
            throw error;
        }
    }
    async removeDraftFile(workspaceId, storedFileId, principal, meta = {}) {
        await this.requireEditable(workspaceId, principal);
        const removed = await this.repository.removeDraftFile(workspaceId, storedFileId, principal.sub, { ...meta, organizationId: principal.organizationId });
        if (!removed)
            throw new common_1.NotFoundException('Draft file not found');
        if (removed.orphaned) {
            await this.safeUnlink(this.pathFor(removed.storageKey));
        }
        return { id: storedFileId };
    }
    async downloadWorkspaceFile(workspaceId, storedFileId, principal, meta = {}) {
        const record = await this.repository.findWorkspaceDownload(workspaceId, storedFileId);
        return this.download(record, principal, meta);
    }
    async downloadVersionFile(versionId, storedFileId, principal, meta = {}) {
        const record = await this.repository.findVersionDownload(versionId, storedFileId);
        return this.download(record, principal, meta);
    }
    async download(record, principal, meta) {
        if (!record)
            throw new common_1.NotFoundException('File not found');
        this.assertReadScope(record.context, principal);
        const path = this.pathFor(record.storageKey);
        await this.repository.recordDownload(record.id, principal.sub, {
            ...meta,
            organizationId: principal.organizationId,
        });
        return {
            stream: (0, node_fs_1.createReadStream)(path),
            originalName: record.originalName,
            mimeType: record.mimeType,
            sizeBytes: record.sizeBytes,
        };
    }
    async requireEditable(workspaceId, principal) {
        const context = await this.repository.findDraftContext(workspaceId);
        if (!context)
            throw new common_1.NotFoundException('Report workspace not found');
        const permission = context.kind === client_1.ReportKind.PROGRESS
            ? 'progress.edit'
            : 'consolidated.edit';
        if (!principal.isAdmin && !principal.permissions.includes(permission)) {
            throw new common_1.ForbiddenException(`${permission} is required`);
        }
        if (!principal.isAdmin &&
            (context.ownerOrganizationId !== principal.organizationId ||
                (context.kind === client_1.ReportKind.PROGRESS
                    ? !context.reportingPeriod.task.collaboratorOrganizationIds.includes(principal.organizationId)
                    : context.reportingPeriod.task.leadOrganizationId !==
                        principal.organizationId))) {
            throw new common_1.ForbiddenException('Report belongs to another organization');
        }
        if ((context.status !== client_1.ReportStatus.DRAFT &&
            context.status !== client_1.ReportStatus.REJECTED) ||
            context.reportingPeriod.status !== 'OPEN' ||
            context.reportingPeriod.task.completedAt ||
            context.reportingPeriod.task.deletedAt) {
            throw new common_1.ConflictException('Report draft is locked');
        }
        return context;
    }
    assertReadScope(context, principal) {
        if (!principal.isAdmin &&
            !principal.permissions.includes('tasks.read') &&
            !principal.permissions.includes('report_history.read')) {
            throw new common_1.ForbiddenException('Report read permission is required');
        }
        if (principal.isAdmin ||
            principal.isStaff ||
            context.reportingPeriod.task.leadOrganizationId ===
                principal.organizationId ||
            (context.kind === client_1.ReportKind.PROGRESS &&
                context.ownerOrganizationId === principal.organizationId)) {
            return;
        }
        throw new common_1.ForbiddenException('File is outside your report scope');
    }
    assertStoredUpload(file) {
        const expected = this.pathFor(file.filename);
        if (!uuidPattern.test(file.filename) ||
            (0, node_path_1.resolve)(file.path) !== expected ||
            file.size < 1) {
            throw new common_1.UnsupportedMediaTypeException('Invalid stored upload');
        }
    }
    pathFor(storageKey) {
        const path = (0, node_path_1.resolve)((0, node_path_1.join)(this.root, storageKey));
        if (!path.startsWith(`${this.root}${node_path_1.sep}`)) {
            throw new common_1.ForbiddenException('Invalid storage key');
        }
        return path;
    }
    async safeUnlink(path) {
        const resolved = (0, node_path_1.resolve)(path);
        if (!resolved.startsWith(`${this.root}${node_path_1.sep}`))
            return;
        try {
            await (0, promises_1.unlink)(resolved);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    }
};
exports.FilesService = FilesService;
exports.FilesService = FilesService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, common_1.Inject)('STORAGE_PATH')),
    __metadata("design:paramtypes", [files_repository_1.FilesRepository, String])
], FilesService);
async function inspectDocument(path) {
    const checksum = (0, node_crypto_1.createHash)('sha256');
    const pdf = Buffer.from('%PDF-');
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const word = Buffer.from('word/');
    const excel = Buffer.from('xl/');
    const wordDocument = Buffer.from('WordDocument', 'utf16le');
    const workbook = Buffer.from('Workbook', 'utf16le');
    const book = Buffer.from('Book', 'utf16le');
    let first = Buffer.alloc(0);
    let carry = Buffer.alloc(0);
    let sizeBytes = 0;
    let hasWord = false;
    let hasExcel = false;
    let hasWordDocument = false;
    let hasWorkbook = false;
    for await (const value of (0, node_fs_1.createReadStream)(path)) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        checksum.update(chunk);
        sizeBytes += chunk.length;
        if (first.length < 8) {
            first = Buffer.concat([first, chunk]).subarray(0, 8);
        }
        const probe = Buffer.concat([carry, chunk]);
        hasWord ||= probe.includes(word);
        hasExcel ||= probe.includes(excel);
        hasWordDocument ||= probe.includes(wordDocument);
        hasWorkbook ||= probe.includes(workbook) || probe.includes(book);
        carry = probe.subarray(Math.max(0, probe.length - 64));
    }
    let type = 'unknown';
    if (first.subarray(0, pdf.length).equals(pdf))
        type = 'pdf';
    else if (first.subarray(0, zip.length).equals(zip)) {
        if (hasWord)
            type = 'docx';
        else if (hasExcel)
            type = 'xlsx';
    }
    else if (first.equals(ole)) {
        if (hasWordDocument)
            type = 'doc';
        else if (hasWorkbook)
            type = 'xls';
    }
    return { type, sizeBytes, checksum: checksum.digest('hex') };
}
//# sourceMappingURL=files.service.js.map