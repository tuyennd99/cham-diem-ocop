import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { Prisma, ProductStatus, StaffPermission } from '@prisma/client';
import { ProductUpdateDto, ProductWriteDto } from '../dtos/products.dto';
import {
  AdminProductCreateDto,
  AdminProductUpdateDto,
} from '../dtos/admin-products.dto';
import { ProductsRepository } from '../repositories/products.repository';
import type { AccessTokenPayload, AuthenticatedPrincipal, RequestMeta } from '../types/auth';
import type { UploadedPrivateFile } from '../types/files';
import type { ProductMutationActor } from '../types/product-mutation';
import { inspectProductUpload } from '../utils/product-files';
import { MAX_IMAGE_BYTES, openStoredFile, resolveStoredPath, storageRoot, uuidStorageKeyPattern } from '../utils/private-storage';
import { effectiveStaffPermissions } from '../utils/staff-permissions';

const publicStatuses = new Set<ProductStatus>([
  ProductStatus.SUBMITTED,
  ProductStatus.SCORING,
  ProductStatus.COMPLETED,
]);

@Injectable()
export class ProductsService {
  private readonly root: string;
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly repository: ProductsRepository) {
    this.root = storageRoot();
  }

  categories() {
    return this.repository.listCategories();
  }

  async listPublic(page: number, limit: number, categoryId?: string, query?: string) {
    const { data, total } = await this.repository.listPublic({ page, limit, categoryId, query });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getPublic(id: string) {
    const product = await this.repository.findPublicById(id);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getPublicAttachment(productId: string, attachmentId: string) {
    const file = await this.repository.findAttachment(productId, attachmentId);
    if (!file || file.type !== 'IMAGE' || !publicStatuses.has(file.product.status)) {
      throw new NotFoundException('Attachment not found');
    }
    return this.asFile(file.filePath, file.fileName);
  }

  listMine(principal: AccessTokenPayload) {
    return this.repository.listMine(principal.sub);
  }

  async getMine(id: string, principal: AccessTokenPayload) {
    const product = await this.repository.findMine(id, principal.sub);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  create(input: ProductWriteDto, principal: AccessTokenPayload) {
    return this.writeCreate(input, { kind: 'OWNER', id: principal.sub });
  }

  async update(id: string, input: ProductUpdateDto, principal: AccessTokenPayload) {
    return this.writeUpdate(id, input, { kind: 'OWNER', id: principal.sub });
  }

  async remove(id: string, principal: AccessTokenPayload) {
    return this.removeDraft(id, { kind: 'OWNER', id: principal.sub });
  }

  async submit(id: string, principal: AccessTokenPayload) {
    return this.submitDraft(id, { kind: 'OWNER', id: principal.sub });
  }

  createForAdmin(
    input: AdminProductCreateDto,
    principal: AuthenticatedPrincipal,
    meta: RequestMeta,
  ) {
    const { registrantId, reason, ...productInput } = input;
    return this.writeCreate(productInput, {
      kind: 'MANAGER',
      id: principal.sub,
      reason,
      meta,
    }, registrantId);
  }

  updateForAdmin(
    id: string,
    input: AdminProductUpdateDto,
    principal: AuthenticatedPrincipal,
    meta: RequestMeta,
  ) {
    const { reason, ...changes } = input;
    return this.writeUpdate(id, changes, {
      kind: 'MANAGER',
      id: principal.sub,
      reason,
      meta,
    });
  }

  removeForAdmin(
    id: string,
    reason: string,
    principal: AuthenticatedPrincipal,
    meta: RequestMeta,
  ) {
    return this.removeDraft(id, {
      kind: 'MANAGER',
      id: principal.sub,
      reason,
      meta,
    });
  }

  submitForAdmin(
    id: string,
    reason: string,
    principal: AuthenticatedPrincipal,
    meta: RequestMeta,
  ) {
    return this.submitDraft(id, {
      kind: 'MANAGER',
      id: principal.sub,
      reason,
      meta,
    });
  }

  async addAttachment(
    id: string,
    file: UploadedPrivateFile | undefined,
    principal: AccessTokenPayload,
  ) {
    return this.storeAttachment(id, file, { kind: 'OWNER', id: principal.sub });
  }

  async addAdminAttachment(
    id: string,
    file: UploadedPrivateFile | undefined,
    reason: string,
    principal: AuthenticatedPrincipal,
    meta: RequestMeta,
  ) {
    return this.storeAttachment(id, file, {
      kind: 'MANAGER', id: principal.sub, reason, meta,
    });
  }

  private async storeAttachment(
    id: string,
    file: UploadedPrivateFile | undefined,
    actor: ProductMutationActor,
  ) {
    if (!file) throw new UnsupportedMediaTypeException('A file is required');
    try {
      this.assertStoredUpload(file);
      const inspected = await inspectProductUpload(file);
      const attachment = await this.repository.addAttachment(id, actor, {
        type: inspected.type,
        fileName: file.originalname,
        filePath: file.filename,
      });
      if (!attachment) await this.assertDraftAvailable(id, actor);
      return attachment;
    } catch (error) {
      try {
        await this.safeUnlink(file.path);
      } catch (cleanupError) {
        this.logger.error(
          'Failed to remove rejected product upload',
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      }
      throw error;
    }
  }

  async removeAttachment(id: string, attachmentId: string, principal: AccessTokenPayload) {
    return this.removeStoredAttachment(id, attachmentId, { kind: 'OWNER', id: principal.sub });
  }

  async removeAdminAttachment(
    id: string,
    attachmentId: string,
    reason: string,
    principal: AuthenticatedPrincipal,
    meta: RequestMeta,
  ) {
    return this.removeStoredAttachment(id, attachmentId, {
      kind: 'MANAGER', id: principal.sub, reason, meta,
    });
  }

  private async removeStoredAttachment(
    id: string,
    attachmentId: string,
    actor: ProductMutationActor,
  ) {
    const path = await this.repository.removeAttachment(id, attachmentId, actor);
    if (!path) await this.assertDraftAvailable(id, actor);
    await this.safeUnlink(this.pathFor(path));
    return { id: attachmentId };
  }

  async getAdminAttachment(
    id: string,
    attachmentId: string,
    principal: AuthenticatedPrincipal,
  ) {
    const canManage = effectiveStaffPermissions(principal).includes(StaffPermission.MANAGE);
    const file = await this.repository.findAdminAttachment(id, attachmentId, canManage);
    if (!file) throw new NotFoundException('Attachment not found');
    return this.asFile(file.filePath, file.fileName);
  }

  async getMyAttachment(id: string, attachmentId: string, principal: AccessTokenPayload) {
    const file = await this.repository.findAttachment(id, attachmentId);
    if (!file || file.product.registrantId !== principal.sub) {
      throw new NotFoundException('Attachment not found');
    }
    return this.asFile(file.filePath, file.fileName);
  }

  private async writeCreate(
    input: ProductWriteDto,
    actor: ProductMutationActor,
    managerRegistrantId?: string,
  ) {
    if (!(await this.repository.categoryExists(input.categoryId))) {
      throw new NotFoundException('Product category not found');
    }
    return this.repository.create({
      registrantId: actor.kind === 'OWNER' ? actor.id : managerRegistrantId!,
      categoryId: input.categoryId,
      name: this.requiredText(input.name, 'Product name'),
      description: input.description?.trim() || null,
      formData: input.formData as unknown as Prisma.InputJsonValue,
      localityId: input.localityId ?? null,
    }, actor);
  }

  private async writeUpdate(
    id: string,
    input: ProductUpdateDto,
    actor: ProductMutationActor,
  ) {
    const changes: {
      categoryId?: string;
      name?: string;
      description?: string | null;
      formData?: Prisma.InputJsonValue;
      localityId?: string | null;
    } = {};
    if (input.categoryId !== undefined) changes.categoryId = input.categoryId;
    if (input.localityId !== undefined) changes.localityId = input.localityId;
    if (input.name !== undefined) changes.name = this.requiredText(input.name, 'Product name');
    if (input.description !== undefined) changes.description = input.description?.trim() || null;
    if (input.formData !== undefined) changes.formData = input.formData as Prisma.InputJsonValue;
    if (input.categoryId && !(await this.repository.categoryExists(input.categoryId))) {
      throw new NotFoundException('Product category not found');
    }
    const product = await this.repository.updateDraft(id, actor, changes);
    if (!product) await this.assertDraftAvailable(id, actor);
    return product;
  }

  private async removeDraft(id: string, actor: ProductMutationActor) {
    const paths = await this.repository.deleteDraft(id, actor);
    if (!paths) await this.assertDraftAvailable(id, actor);
    await Promise.all(paths.map((path) => this.safeUnlink(this.pathFor(path))));
    return { id };
  }

  private async submitDraft(id: string, actor: ProductMutationActor) {
    const product = await this.repository.submitDraft(id, actor);
    if (!product) await this.assertDraftAvailable(id, actor);
    return product;
  }

  private async assertDraftAvailable(
    id: string,
    actor: ProductMutationActor,
  ): Promise<never> {
    const product = await this.repository.findForMutation(id, actor);
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== ProductStatus.DRAFT) {
      throw new ConflictException('Only draft products can be changed');
    }
    throw new ConflictException('Product could not be changed');
  }

  private requiredText(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(`${label} is required`);
    return trimmed;
  }

  private assertStoredUpload(file: UploadedPrivateFile) {
    const expected = this.pathFor(file.filename);
    if (
      !uuidStorageKeyPattern.test(file.filename) ||
      resolve(file.path) !== expected ||
      file.size < 1
    ) {
      throw new UnsupportedMediaTypeException('Invalid stored upload');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new PayloadTooLargeException('Attachment exceeds 10 MiB');
    }
  }

  private pathFor(storageKey: string) {
    return resolveStoredPath(storageKey, this.root);
  }

  private asFile(storageKey: string, originalName: string) {
    return openStoredFile(storageKey, originalName, this.root);
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
