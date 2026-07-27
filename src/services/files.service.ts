import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { basename, extname, join, resolve, sep } from 'node:path';
import { ReportKind, ReportStatus } from '../prisma/client';
import {
  DownloadRecord,
  DraftFileContext,
  FilesRepository,
} from '../repositories/files.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { MAX_DRAFT_BYTES, storageRoot } from '../utils/private-storage';

export { MAX_DRAFT_BYTES };

export type DocumentType = 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'unknown';

const documentMimes: Record<Exclude<DocumentType, 'unknown'>, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UploadedPrivateFile {
  originalname: string;
  mimetype: string;
  filename: string;
  path: string;
  size: number;
}

export function assertDraftSize(sizeBytes: number) {
  if (sizeBytes > MAX_DRAFT_BYTES) {
    throw new PayloadTooLargeException('Draft attachments exceed 200MB');
  }
}

export function assertAllowedDocument(
  originalName: string,
  declaredMime: string,
  detectedType: DocumentType,
) {
  if (
    !originalName ||
    originalName !== basename(originalName) ||
    /[\0\r\n]/.test(originalName)
  ) {
    throw new UnsupportedMediaTypeException('Invalid file name');
  }
  const extension = extname(originalName).slice(1).toLowerCase();
  if (
    detectedType === 'unknown' ||
    extension !== detectedType ||
    documentMimes[detectedType] !== declaredMime
  ) {
    throw new UnsupportedMediaTypeException(
      'File extension, MIME, and content must match',
    );
  }
}

@Injectable()
export class FilesService {
  private readonly root: string;

  constructor(
    private readonly repository: FilesRepository,
    @Optional() @Inject('STORAGE_PATH') root?: string,
  ) {
    this.root = storageRoot(root);
  }

  async uploadDraftFile(
    workspaceId: number,
    file: UploadedPrivateFile | undefined,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    if (!file) {
      throw new UnsupportedMediaTypeException('A document file is required');
    }
    try {
      await this.requireEditable(workspaceId, principal);
      this.assertStoredUpload(file);
      const inspected = await inspectDocument(file.path);
      assertAllowedDocument(file.originalname, file.mimetype, inspected.type);
      assertDraftSize(
        (await this.repository.draftSize(workspaceId)) + inspected.sizeBytes,
      );
      const stored = await this.repository.addDraftFile(
        workspaceId,
        {
          originalName: file.originalname,
          storageKey: file.filename,
          mimeType:
            documentMimes[inspected.type as Exclude<DocumentType, 'unknown'>],
          sizeBytes: inspected.sizeBytes,
          checksum: inspected.checksum,
        },
        principal.sub,
        MAX_DRAFT_BYTES,
        { ...meta, organizationId: principal.organizationId },
      );
      if (!stored) {
        throw new PayloadTooLargeException('Draft attachments exceed 200MB');
      }
      return stored;
    } catch (error) {
      await this.safeUnlink(file.path);
      throw error;
    }
  }

  async removeDraftFile(
    workspaceId: number,
    storedFileId: number,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    await this.requireEditable(workspaceId, principal);
    const removed = await this.repository.removeDraftFile(
      workspaceId,
      storedFileId,
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!removed) throw new NotFoundException('Draft file not found');
    if (removed.orphaned) {
      await this.safeUnlink(this.pathFor(removed.storageKey));
    }
    return { id: storedFileId };
  }

  async downloadWorkspaceFile(
    workspaceId: number,
    storedFileId: number,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const record = await this.repository.findWorkspaceDownload(
      workspaceId,
      storedFileId,
    );
    return this.download(record, principal, meta);
  }

  async downloadVersionFile(
    versionId: number,
    storedFileId: number,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const record = await this.repository.findVersionDownload(
      versionId,
      storedFileId,
    );
    return this.download(record, principal, meta);
  }

  private async download(
    record: DownloadRecord | null,
    principal: AccessTokenPayload,
    meta: RequestMeta,
  ) {
    if (!record) throw new NotFoundException('File not found');
    this.assertReadScope(record.context, principal);
    const path = this.pathFor(record.storageKey);
    await this.repository.recordDownload(record.id, principal.sub, {
      ...meta,
      organizationId: principal.organizationId,
    });
    return {
      stream: createReadStream(path),
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    };
  }

  private async requireEditable(
    workspaceId: number,
    principal: AccessTokenPayload,
  ) {
    const context = await this.repository.findDraftContext(workspaceId);
    if (!context) throw new NotFoundException('Report workspace not found');
    const permission =
      context.kind === ReportKind.PROGRESS
        ? 'progress.edit'
        : 'consolidated.edit';
    if (!principal.isAdmin && !principal.permissions.includes(permission)) {
      throw new ForbiddenException(`${permission} is required`);
    }
    if (
      !principal.isAdmin &&
      (context.ownerOrganizationId !== principal.organizationId ||
        (context.kind === ReportKind.PROGRESS
          ? !context.reportingPeriod.task.collaboratorOrganizationIds.includes(
              principal.organizationId,
            )
          : context.reportingPeriod.task.leadOrganizationId !==
            principal.organizationId))
    ) {
      throw new ForbiddenException('Report belongs to another organization');
    }
    if (
      (context.status !== ReportStatus.DRAFT &&
        context.status !== ReportStatus.REJECTED) ||
      context.reportingPeriod.status !== 'OPEN' ||
      context.reportingPeriod.task.completedAt ||
      context.reportingPeriod.task.deletedAt
    ) {
      throw new ConflictException('Report draft is locked');
    }
    return context;
  }

  private assertReadScope(
    context: DraftFileContext,
    principal: AccessTokenPayload,
  ) {
    if (
      !principal.isAdmin &&
      !principal.permissions.includes('tasks.read') &&
      !principal.permissions.includes('report_history.read')
    ) {
      throw new ForbiddenException('Report read permission is required');
    }
    if (
      principal.isAdmin ||
      principal.isStaff ||
      context.reportingPeriod.task.leadOrganizationId ===
        principal.organizationId ||
      (context.kind === ReportKind.PROGRESS &&
        context.ownerOrganizationId === principal.organizationId)
    ) {
      return;
    }
    throw new ForbiddenException('File is outside your report scope');
  }

  private assertStoredUpload(file: UploadedPrivateFile) {
    const expected = this.pathFor(file.filename);
    if (
      !uuidPattern.test(file.filename) ||
      resolve(file.path) !== expected ||
      file.size < 1
    ) {
      throw new UnsupportedMediaTypeException('Invalid stored upload');
    }
  }

  private pathFor(storageKey: string) {
    const path = resolve(join(this.root, storageKey));
    if (!path.startsWith(`${this.root}${sep}`)) {
      throw new ForbiddenException('Invalid storage key');
    }
    return path;
  }

  private async safeUnlink(path: string) {
    const resolved = resolve(path);
    if (!resolved.startsWith(`${this.root}${sep}`)) return;
    try {
      await unlink(resolved);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

async function inspectDocument(path: string) {
  const checksum = createHash('sha256');
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

  for await (const value of createReadStream(path)) {
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

  let type: DocumentType = 'unknown';
  if (first.subarray(0, pdf.length).equals(pdf)) type = 'pdf';
  else if (first.subarray(0, zip.length).equals(zip)) {
    if (hasWord) type = 'docx';
    else if (hasExcel) type = 'xlsx';
  } else if (first.equals(ole)) {
    if (hasWordDocument) type = 'doc';
    else if (hasWorkbook) type = 'xls';
  }
  return { type, sizeBytes, checksum: checksum.digest('hex') };
}
