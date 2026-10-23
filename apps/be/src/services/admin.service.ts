import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { EvaluationStatus, ProductStatus } from '@prisma/client';
import {
  CreateJudgeDto,
  ReplaceAssignmentsDto,
  ResetJudgePasswordDto,
  UpdateJudgeDto,
  UpdateStaffAccessDto,
} from '../dtos/admin.dto';
import { AdminProductQueryDto } from '../dtos/admin-products.dto';
import { AdminRepository, type AdminRequestMeta } from '../repositories/admin.repository';
import { PASSWORD_MAX_BYTES, PASSWORD_ROUNDS } from '../constants/auth';

@Injectable()
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  async dashboard(canManage = true) {
    const { productStatuses, judgeProgress, nextProducts } = await this.repository.dashboardData(canManage);
    const productsByStatus = Object.fromEntries(
      Object.values(ProductStatus).map((status) => [status, 0]),
    ) as Record<ProductStatus, number>;
    for (const row of productStatuses) productsByStatus[row.status] = row._count._all;

    return {
      productsByStatus,
      judges: judgeProgress.map((judge) => ({ ...judge, pending: judge.assigned - judge.submitted })),
      needsAttention: nextProducts.map((product) => {
        const assignedJudgeIds = new Set(product.category.assignments.map(({ judgeId }) => judgeId));
        const submitted = new Set(product.evaluations
          .filter((evaluation) => evaluation.status === EvaluationStatus.SUBMITTED && assignedJudgeIds.has(evaluation.judgeId))
          .map(({ judgeId }) => judgeId));
        return {
          id: product.id,
          name: product.name,
          status: product.status,
          submittedAt: product.submittedAt,
          category: {
            id: product.category.id,
            name: product.category.name,
            groupName: product.category.groupName,
          },
          assignedJudgeCount: assignedJudgeIds.size,
          submittedEvaluationCount: submitted.size,
          pendingEvaluationCount: assignedJudgeIds.size - submitted.size,
        };
      }),
    };
  }

  listJudges() {
    return this.repository.listJudges();
  }

  async updateStaffAccess(id: string, input: UpdateStaffAccessDto, actorId: string, meta: AdminRequestMeta) {
    if (!input.reason.trim()) throw new BadRequestException('Reason is required');
    const user = await this.repository.updateStaffAccess(id, { ...input, reason: input.reason.trim() }, actorId, meta);
    if (!user) throw new NotFoundException('Staff user not found');
    return user;
  }

  async createJudge(input: CreateJudgeDto, actorId: string, meta: AdminRequestMeta) {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    if (!fullName) throw new BadRequestException('Full name is required');
    const password = await this.hashPassword(input.password);
    try {
      return await this.repository.createJudge({
        email,
        fullName,
        phone: input.phone?.trim() || null,
        password,
        organizationUnitId: input.organizationUnitId,
        reason: input.reason.trim(),
      }, actorId, meta);
    } catch (error) {
      if (this.isUniqueConstraint(error)) throw new ConflictException('Email is already registered');
      throw error;
    }
  }

  async updateJudge(id: string, input: UpdateJudgeDto, actorId: string, meta: AdminRequestMeta) {
    if (!input.reason.trim()) throw new BadRequestException('Reason is required');
    if (input.fullName !== undefined && !input.fullName.trim()) {
      throw new BadRequestException('Full name is required');
    }
    const judge = await this.repository.updateJudge({
      id,
      input: {
        ...input,
        ...(input.fullName === undefined ? {} : { fullName: input.fullName.trim() }),
        ...(input.phone === undefined ? {} : { phone: input.phone?.trim() || null }),
        reason: input.reason.trim(),
      },
      actorId,
      meta,
    });
    if (!judge) throw new NotFoundException('Judge not found');
    return judge;
  }

  async deactivateJudge(id: string, reason: string, actorId: string, meta: AdminRequestMeta) {
    if (!reason.trim()) throw new BadRequestException('Reason is required');
    const judge = await this.repository.deactivateJudge(id, reason.trim(), actorId, meta);
    if (!judge) throw new NotFoundException('Judge not found');
    return judge;
  }

  async resetJudgePassword(id: string, input: ResetJudgePasswordDto, actorId: string, meta: AdminRequestMeta) {
    if (!input.reason.trim()) throw new BadRequestException('Reason is required');
    const password = await this.hashPassword(input.password);
    const found = await this.repository.resetJudgePassword(id, password, input.reason.trim(), actorId, meta);
    if (!found) throw new NotFoundException('Judge not found');
    return { id };
  }

  listAssignments() {
    return this.repository.listAssignments();
  }

  async replaceAssignments(input: ReplaceAssignmentsDto, actorId: string, meta: AdminRequestMeta) {
    const entries = input.assignments;
    return this.repository.replaceAssignments(entries, actorId, input.reason, meta);
  }

  async listProducts(query: AdminProductQueryDto, canManage = true) {
    if (!Number.isSafeInteger((query.page - 1) * query.limit)) {
      throw new BadRequestException('Page offset is too large');
    }
    if ((query.localityId && query.unmappedLocality) ||
        (query.from === undefined) !== (query.toExclusive === undefined)) {
      throw new BadRequestException('Invalid product filter combination');
    }
    if (query.from && query.toExclusive &&
        new Date(query.from).getTime() >= new Date(query.toExclusive).getTime()) {
      throw new BadRequestException('from must be before toExclusive');
    }
    const { data, total } = await this.repository.listProducts(query, canManage);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async productDetail(id: string, canManage = true) {
    const product = await this.repository.findAdminProduct(id, canManage);
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async productAttachments(id: string, canManage = true) {
    const attachments = await this.repository.findAdminAttachments(id, canManage);
    if (!attachments) throw new NotFoundException('Product not found');
    return attachments;
  }

  async productResults(id: string, canManage = true) {
    const result = await this.repository.productResults(id, canManage);
    if (!result) throw new NotFoundException('Product not found');
    return result;
  }

  private async hashPassword(password: string) {
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
      throw new BadRequestException(`Password must be at most ${PASSWORD_MAX_BYTES} UTF-8 bytes`);
    }
    return bcrypt.hash(password, PASSWORD_ROUNDS);
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
