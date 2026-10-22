import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { EvaluationStatus, ProductStatus } from '@prisma/client';
import {
  AdminProductsQueryDto,
  CreateJudgeDto,
  ReplaceAssignmentsDto,
  ResetJudgePasswordDto,
  UpdateJudgeDto,
} from '../dtos/admin.dto';
import { AdminRepository, type AdminRequestMeta } from '../repositories/admin.repository';
import { PASSWORD_MAX_BYTES, PASSWORD_ROUNDS } from '../constants/auth';

@Injectable()
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  async dashboard() {
    const { productStatuses, judgeProgress, nextProducts } = await this.repository.dashboardData();
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
      }, actorId, meta);
    } catch (error) {
      if (this.isUniqueConstraint(error)) throw new ConflictException('Email is already registered');
      throw error;
    }
  }

  async updateJudge(id: string, input: UpdateJudgeDto, actorId: string, meta: AdminRequestMeta) {
    if (input.fullName !== undefined && !input.fullName.trim()) {
      throw new BadRequestException('Full name is required');
    }
    const judge = await this.repository.updateJudge({
      id,
      input: {
        ...input,
        ...(input.fullName === undefined ? {} : { fullName: input.fullName.trim() }),
        ...(input.phone === undefined ? {} : { phone: input.phone?.trim() || null }),
        ...(input.reason === undefined ? {} : { reason: input.reason.trim() || undefined }),
      },
      actorId,
      meta,
    });
    if (!judge) throw new NotFoundException('Judge not found');
    return judge;
  }

  async deactivateJudge(id: string, actorId: string, meta: AdminRequestMeta) {
    const result = await this.repository.deactivateJudge(id, actorId, meta);
    if (!result) throw new NotFoundException('Judge not found');
    if (result.blocked) {
      throw new ConflictException('Reassign open products before deactivating this judge');
    }
    return result.judge;
  }

  async resetJudgePassword(id: string, input: ResetJudgePasswordDto, actorId: string, meta: AdminRequestMeta) {
    const password = await this.hashPassword(input.password);
    const found = await this.repository.resetJudgePassword(id, password, input.reason, actorId, meta);
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

  async listProducts(query: AdminProductsQueryDto) {
    const { data, total } = await this.repository.listProducts(query.page, query.limit);
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  }

  async productResults(id: string) {
    const result = await this.repository.productResults(id);
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
