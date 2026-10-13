import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Prisma, ProductStatus } from '@prisma/client';
import { ProductUpdateDto, ProductWriteDto } from '../dtos/products.dto';
import { ProductsRepository } from '../repositories/products.repository';
import type { AccessTokenPayload } from '../types/auth';
import type { UploadedPrivateFile } from '../types/files';
import { inspectProductUpload } from '../utils/product-files';
import { MAX_IMAGE_BYTES, storageRoot } from '../utils/private-storage';
import { stat } from 'node:fs/promises';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicStatuses = new Set<ProductStatus>([
  ProductStatus.SUBMITTED,
  ProductStatus.SCORING,
  ProductStatus.COMPLETED,
]);

@Injectable()
export class ProductsService {
  private readonly root: string;

  constructor(private readonly repository: ProductsRepository) {
    this.root = storageRoot();
  }

  categories() {
    return this.repository.listCategories();
  }

  async listPublic(page: number, limit: number, categoryId?: string) {
    const { data, total } = await this.repository.listPublic({ page, limit, categoryId });
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

  create(input: ProductWriteDto, principal: AccessTokenPayload) {
    return this.writeCreate(input, principal.sub);
  }

  async update(id: string, input: ProductUpdateDto, principal: AccessTokenPayload) {
    const changes: {
      categoryId?: string;
      name?: string;
      description?: string | null;
      formData?: Prisma.InputJsonValue;
    } = {};
    if (input.categoryId !== undefined) changes.categoryId = input.categoryId;
    if (input.name !== undefined) changes.name = this.requiredText(input.name, 'Product name');
    if (input.description !== undefined) changes.description = input.description?.trim() || null;
    if (input.formData !== undefined) changes.formData = input.formData as Prisma.InputJsonValue;
    if (input.categoryId && !(await this.repository.categoryExists(input.categoryId))) {
      throw new NotFoundException('Product category not found');
    }
    const product = await this.repository.updateDraft(id, principal.sub, changes);
    if (!product) await this.assertDraftOwnership(id, principal.sub);
    return product;
  }

  async remove(id: string, principal: AccessTokenPayload) {
    const paths = await this.repository.deleteDraft(id, principal.sub);
    if (!paths) await this.assertDraftOwnership(id, principal.sub);
    await Promise.all(paths.map((path) => this.safeUnlink(this.pathFor(path))));
    return { id };
  }

  async submit(id: string, principal: AccessTokenPayload) {
    const product = await this.repository.submitDraft(id, principal.sub);
    if (!product) await this.assertDraftOwnership(id, principal.sub);
    return product;
  }

  async addAttachment(
    id: string,
    file: UploadedPrivateFile | undefined,
    principal: AccessTokenPayload,
  ) {
    if (!file) throw new UnsupportedMediaTypeException('A file is required');
    try {
      this.assertStoredUpload(file);
      const inspected = await inspectProductUpload(file);
      const attachment = await this.repository.addAttachment(id, principal.sub, {
        type: inspected.type,
        fileName: file.originalname,
        filePath: file.filename,
      });
      if (!attachment) await this.assertDraftOwnership(id, principal.sub);
      return attachment;
    } catch (error) {
      await this.safeUnlink(file.path);
      throw error;
    }
  }

  async removeAttachment(id: string, attachmentId: string, principal: AccessTokenPayload) {
    const path = await this.repository.removeAttachment(id, attachmentId, principal.sub);
    if (!path) await this.assertDraftOwnership(id, principal.sub);
    await this.safeUnlink(this.pathFor(path));
    return { id: attachmentId };
  }

  async getMyAttachment(id: string, attachmentId: string, principal: AccessTokenPayload) {
    const file = await this.repository.findAttachment(id, attachmentId);
    if (!file || file.product.registrantId !== principal.sub) {
      throw new NotFoundException('Attachment not found');
    }
    return this.asFile(file.filePath, file.fileName);
  }

  private async writeCreate(input: ProductWriteDto, registrantId: string) {
    if (!(await this.repository.categoryExists(input.categoryId))) {
      throw new NotFoundException('Product category not found');
    }
    return this.repository.create({
      registrantId,
      categoryId: input.categoryId,
      name: this.requiredText(input.name, 'Product name'),
      description: input.description?.trim() || null,
      formData: input.formData,
    });
  }

  private async assertDraftOwnership(id: string, registrantId: string): Promise<never> {
    const product = await this.repository.findMine(id, registrantId);
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
      !uuidPattern.test(file.filename) ||
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
    const path = resolve(join(this.root, storageKey));
    if (!uuidPattern.test(storageKey) || !path.startsWith(`${this.root}${sep}`)) {
      throw new ForbiddenException('Invalid storage key');
    }
    return path;
  }

  private async asFile(storageKey: string, originalName: string) {
    const path = this.pathFor(storageKey);
    const extension = originalName.split('.').pop()?.toLowerCase();
    const mimeType: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      webp: 'image/webp', pdf: 'application/pdf',
    };
    const info = await stat(path);
    return {
      stream: createReadStream(path),
      originalName,
      mimeType: mimeType[extension ?? ''] ?? 'application/octet-stream',
      sizeBytes: info.size,
    };
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
