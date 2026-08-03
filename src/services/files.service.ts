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
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { PeriodStatus, ReportKind, ReportStatus } from '@prisma/client';
import {
  DownloadRecord,
  DraftFileContext,
  FilesRepository,
} from '../repositories/files.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import type { UploadedPrivateFile } from '../types/files';
import {
  assertAllowedDocument,
  assertDraftSize,
  documentMime,
  inspectDocument,
} from '../utils/document-files';
import { MAX_DRAFT_BYTES, storageRoot } from '../utils/private-storage';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    console.log("🚀 ~ FilesService ~ uploadDraftFile ~ file:", file)
    if (!file) {
      throw new UnsupportedMediaTypeException('A document file is required');
    }
    try {
      await this.requireEditable(workspaceId, principal);
      this.assertStoredUpload(file);
      const documentType = assertAllowedDocument(file.originalname);
      const inspected = await inspectDocument(file.path);
      assertDraftSize(
        (await this.repository.draftSize(workspaceId)) + inspected.sizeBytes,
      );
      const stored = await this.repository.addDraftFile(
        workspaceId,
        {
          originalName: file.originalname,
          storageKey: file.filename,
          mimeType: documentMime(documentType),
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
      context.reportingPeriod.status !== PeriodStatus.OPEN ||
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
      principal.permissions.includes('tasks.read.all') ||
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
