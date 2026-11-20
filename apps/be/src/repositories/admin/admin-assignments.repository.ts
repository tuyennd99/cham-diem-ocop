import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EvaluationStatus,
  Prisma,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import {
  EVALUATION_HISTORY_ACTION,
  PRODUCT_RESULT_HISTORY_ACTION,
} from '../../constants/products';
import type { AddProductJudgeAssignmentDto } from '../../dtos/admin-products.dto';
import type { UpdateStaffAccessDto } from '../../dtos/admin.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { databaseObject } from '../../prisma/sql';
import {
  assertOpenProductsCoveredByAssignments,
  assignmentKey,
  computeChangedAssignmentKeys,
  parseAssignmentKey,
  validateAssignmentCriteriaScope,
} from '../../utils/assignment-coverage';
import {
  lockEvaluationCategory,
  recomputeProductResult,
} from '../../utils/evaluation-result';
import {
  applyStaffAccess,
  createStaff,
  lockStaffMutation,
} from '../../utils/staff-access';
import { writeAudit, type AuditInput } from '../../utils/audit-log';
import { AdminProductsRepository } from './admin-products.repository';
import { parseSnapshotAgencies, type AdminRequestMeta } from './admin-shared';

@Injectable()
export class AdminAssignmentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminProducts: AdminProductsRepository,
  ) {}

  listJudges() {
    return this.prisma.user.findMany({
      where: {
        role: { not: Role.REGISTRANT },
        staffPermissions: { has: StaffPermission.SCORE },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        verified: true,
        isActive: true,
        createdAt: true,
        organizationUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            managingAgencyId: true,
            managingAgency: {
              select: {
                id: true,
                code: true,
                name: true,
                order: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
  }

  async listEligibleJudgesForProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        requiredAgencySnapshot: true,
        category: {
          select: {
            agencyLinks: {
              select: {
                agency: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    order: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        judgeAssignments: {
          where: { isActive: true },
          select: { judgeId: true },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    const snapshotAgencies = parseSnapshotAgencies(
      product.requiredAgencySnapshot,
    ).filter((a) => a.isActive);
    const categoryAgencies = product.category.agencyLinks
      .map((l) => l.agency)
      .filter((a) => a.isActive);
    const allowedAgencyIds = (
      snapshotAgencies.length > 0 ? snapshotAgencies : categoryAgencies
    ).map((a) => a.id);
    const activeAssignedJudgeIds = product.judgeAssignments.map(
      (a) => a.judgeId,
    );

    return this.prisma.user.findMany({
      where: {
        role: { not: Role.REGISTRANT },
        staffPermissions: { has: StaffPermission.SCORE },
        isActive: true,
        verified: true,
        ...(activeAssignedJudgeIds.length > 0
          ? { id: { notIn: activeAssignedJudgeIds } }
          : {}),
        ...(allowedAgencyIds.length > 0
          ? {
              organizationUnit: {
                is: {
                  isActive: true,
                  managingAgencyId: { in: allowedAgencyIds },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        verified: true,
        isActive: true,
        createdAt: true,
        organizationUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            managingAgencyId: true,
            managingAgency: {
              select: {
                id: true,
                code: true,
                name: true,
                order: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
  }

  createJudge(
    input: {
      email: string;
      fullName: string;
      phone: string | null;
      password: string;
      organizationUnitId: string;
      reason: string;
    },
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const judge = await createStaff(
        tx,
        { ...input, staffPermissions: [StaffPermission.SCORE] },
        actorId,
        meta,
        'judge.create',
      );
      return {
        id: judge.id,
        email: judge.email,
        fullName: judge.fullName,
        phone: judge.phone,
        verified: judge.verified,
        isActive: judge.isActive,
        createdAt: judge.createdAt,
      };
    });
  }

  async updateJudge(args: {
    id: string;
    input: { fullName?: string; phone?: string | null; reason: string };
    actorId: string;
    meta: AdminRequestMeta;
  }) {
    const { id, input, actorId, meta } = args;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await tx.user.findFirst({
        where: {
          id,
          role: { not: Role.REGISTRANT },
          staffPermissions: { has: StaffPermission.SCORE },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          isActive: true,
        },
      });
      if (!before) return null;
      const { reason, ...changes } = input;
      const after = await tx.user.update({
        where: { id },
        data: changes,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          verified: true,
          isActive: true,
          createdAt: true,
        },
      });
      await this.audit(tx, {
        actorId,
        action: 'judge.update',
        entityType: 'User',
        entityId: id,
        beforeData: before,
        afterData: after,
        reason,
        ...meta,
      });
      return after;
    });
  }

  async deactivateJudge(
    id: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockStaffMutation(tx);
      const before = await tx.user.findFirst({
        where: {
          id,
          role: { not: Role.REGISTRANT },
          staffPermissions: { has: StaffPermission.SCORE },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          organizationUnitId: true,
          staffPermissions: true,
        },
      });
      if (!before) return null;
      const changed = await applyStaffAccess(
        tx,
        id,
        {
          staffPermissions: before.staffPermissions,
          organizationUnitId: before.organizationUnitId,
          isActive: false,
          reason,
        },
        actorId,
        meta,
        'judge.deactivate',
      );
      if (!changed) return null;
      return {
        id: changed.id,
        email: before.email,
        fullName: before.fullName,
        isActive: changed.isActive,
      };
    });
  }

  async resetJudgePassword(
    id: string,
    password: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const judge = await tx.user.findFirst({
        where: {
          id,
          role: { not: Role.REGISTRANT },
          staffPermissions: { has: StaffPermission.SCORE },
        },
        select: { id: true, email: true },
      });
      if (!judge) return false;
      const after = await tx.user.update({
        where: { id },
        data: { password, tokenVersion: { increment: 1 } },
        select: { email: true, verified: true },
      });
      await this.audit(tx, {
        actorId,
        action: 'judge.password_reset',
        entityType: 'User',
        entityId: id,
        beforeData: { email: judge.email },
        afterData: {
          email: after.email,
          verified: after.verified,
          passwordReset: true,
        },
        reason,
        ...meta,
      });
      return true;
    });
  }

  async updateStaffAccess(
    id: string,
    input: UpdateStaffAccessDto,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockStaffMutation(tx);
        return applyStaffAccess(tx, id, input, actorId, meta);
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  listAssignments() {
    return this.prisma.judgeAssignment.findMany({
      include: {
        judge: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { judge: { fullName: 'asc' } }],
    });
  }

  private async assertNoSubmittedScopeChange(
    tx: Prisma.TransactionClient,
    changedKeys: Set<string>,
    openProducts: Array<{ id: string }>,
  ) {
    if (!changedKeys.size || !openProducts.length) return;
    const submitted = await tx.evaluation.findMany({
      where: {
        productId: { in: openProducts.map(({ id }) => id) },
        status: EvaluationStatus.SUBMITTED,
      },
      select: {
        judgeId: true,
        product: { select: { categoryId: true } },
      },
    });
    const conflicts = submitted.some(({ judgeId, product }) =>
      changedKeys.has(assignmentKey(judgeId, product.categoryId)),
    );
    if (conflicts) {
      throw new ConflictException(
        'Cannot change criteria for a submitted evaluation',
      );
    }
  }

  private async recomputeAffectedOpenProducts(
    tx: Prisma.TransactionClient,
    changedKeys: Set<string>,
    hasChanges: boolean,
    openProducts: Array<{ id: string; categoryId: string }>,
    actorId: string,
  ) {
    if (!changedKeys.size) {
      if (!hasChanges) return;
      for (const product of openProducts) {
        await recomputeProductResult(tx, product.id, actorId);
      }
      return;
    }
    const changedPairs = [...changedKeys].map((key) => {
      const [judgeId, categoryId] = parseAssignmentKey(key);
      return { judgeId, categoryId };
    });
    const changedCategoryIds = [
      ...new Set(changedPairs.map(({ categoryId }) => categoryId)),
    ];
    const inProgress = await tx.evaluation.findMany({
      where: {
        status: EvaluationStatus.IN_PROGRESS,
        judgeId: { in: changedPairs.map(({ judgeId }) => judgeId) },
        product: {
          categoryId: { in: changedCategoryIds },
          status: {
            in: [
              ProductStatus.SUBMITTED,
              ProductStatus.APPROVED,
              ProductStatus.SCORING,
            ],
          },
        },
      },
      select: {
        id: true,
        judgeId: true,
        product: { select: { categoryId: true } },
      },
    });
    const resetIds = inProgress
      .filter(({ judgeId, product }) =>
        changedKeys.has(assignmentKey(judgeId, product.categoryId)),
      )
      .map(({ id }) => id);
    if (resetIds.length) {
      await tx.score.deleteMany({
        where: { evaluationId: { in: resetIds } },
      });
      await tx.evaluation.updateMany({
        where: { id: { in: resetIds } },
        data: { total: null },
      });
    }
    for (const product of openProducts) {
      if (changedCategoryIds.includes(product.categoryId)) {
        await recomputeProductResult(tx, product.id, actorId);
      }
    }
  }

  async replaceAssignments(
    assignments: Array<{
      judgeId: string;
      categoryId: string;
      criterionIds: string[];
    }>,
    actorId: string,
    reason: string | undefined,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM ${databaseObject('product_categories')}
        ORDER BY "id" FOR UPDATE
      `);
        const judgeIds = [
          ...new Set(assignments.map(({ judgeId }) => judgeId)),
        ];
        const categoryIds = [
          ...new Set(assignments.map(({ categoryId }) => categoryId)),
        ];
        const judges = await tx.user.findMany({
          where: {
            id: { in: judgeIds },
            role: { not: Role.REGISTRANT },
            staffPermissions: { has: StaffPermission.SCORE },
            isActive: true,
            verified: true,
          },
          select: { id: true },
        });
        const categories = await tx.productCategory.findMany({
          select: {
            id: true,
            name: true,
            criteriaSet: {
              select: { criteria: { select: { id: true, code: true } } },
            },
          },
        });
        if (judges.length !== judgeIds.length)
          throw new BadRequestException(
            'Assignments must reference active judges',
          );
        if (
          categories.filter(({ id }) => categoryIds.includes(id)).length !==
          categoryIds.length
        ) {
          throw new BadRequestException('Assignment category not found');
        }
        const categoryById = new Map(
          categories.map((category) => [category.id, category]),
        );
        validateAssignmentCriteriaScope(assignments, categoryById);

        const before = await tx.judgeAssignment.findMany({
          orderBy: [{ categoryId: 'asc' }, { judgeId: 'asc' }],
        });
        const openProducts = await tx.product.findMany({
          where: {
            status: {
              in: [
                ProductStatus.SUBMITTED,
                ProductStatus.APPROVED,
                ProductStatus.SCORING,
              ],
            },
          },
          select: { id: true, categoryId: true },
        });
        assertOpenProductsCoveredByAssignments(
          assignments,
          openProducts,
          categories,
        );

        const { changedKeys, hasChanges } = computeChangedAssignmentKeys(
          before,
          assignments,
          categoryById,
        );
        await this.assertNoSubmittedScopeChange(tx, changedKeys, openProducts);

        await tx.judgeAssignment.deleteMany();
        if (assignments.length)
          await tx.judgeAssignment.createMany({ data: assignments });

        await this.recomputeAffectedOpenProducts(
          tx,
          changedKeys,
          hasChanges,
          openProducts,
          actorId,
        );

        const after = await tx.judgeAssignment.findMany({
          orderBy: [{ categoryId: 'asc' }, { judgeId: 'asc' }],
        });
        await this.audit(tx, {
          actorId,
          action: 'assignments.replace',
          entityType: 'JudgeAssignment',
          beforeData: before,
          afterData: after,
          reason,
          ...meta,
        });
        return after;
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  async addProductJudgeAssignment(
    productId: string,
    input: AddProductJudgeAssignmentDto,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );

        const product = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            categoryId: true,
            status: true,
            requiredAgencySnapshot: true,
            category: {
              select: {
                id: true,
                name: true,
                agencyLinks: {
                  select: {
                    agency: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        order: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (product.categoryId !== initial.categoryId) {
          throw new ConflictException(
            'Product category changed while adding judge assignment',
          );
        }

        if (product.status === ProductStatus.COMPLETED) {
          throw new ConflictException(
            'Hồ sơ đã hoàn tất chấm điểm. Vui lòng mở lại hồ sơ trước khi bổ sung giám khảo.',
          );
        }
        if (
          product.status !== ProductStatus.APPROVED &&
          product.status !== ProductStatus.SCORING
        ) {
          throw new ConflictException(
            'Chỉ có thể bổ sung giám khảo cho hồ sơ đã được duyệt hoặc đang chấm điểm.',
          );
        }

        const judge = await tx.user.findUnique({
          where: { id: input.judgeId },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            staffPermissions: true,
            isActive: true,
            verified: true,
            organizationUnit: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                managingAgencyId: true,
                managingAgency: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        });
        if (
          !judge ||
          judge.role === Role.REGISTRANT ||
          !judge.staffPermissions.includes(StaffPermission.SCORE) ||
          !judge.isActive ||
          !judge.verified
        ) {
          throw new BadRequestException(
            'Giám khảo được chọn không hợp lệ hoặc đang bị vô hiệu hóa.',
          );
        }

        const snapshotAgencies = parseSnapshotAgencies(
          product.requiredAgencySnapshot,
        ).filter((a) => a.isActive);
        const categoryAgencies = product.category.agencyLinks
          .map((l) => l.agency)
          .filter((a) => a.isActive);
        const allowedAgencyIds = new Set(
          (snapshotAgencies.length > 0
            ? snapshotAgencies
            : categoryAgencies
          ).map((a) => a.id),
        );
        if (allowedAgencyIds.size > 0 && !judge.organizationUnit?.isActive) {
          throw new BadRequestException(
            'Đơn vị công tác của giám khảo đang bị vô hiệu hóa.',
          );
        }
        const judgeAgencyId = judge.organizationUnit?.managingAgencyId ?? null;
        if (
          allowedAgencyIds.size > 0 &&
          (!judgeAgencyId || !allowedAgencyIds.has(judgeAgencyId))
        ) {
          throw new BadRequestException(
            'Giám khảo không thuộc cơ quan quản lý của phân loại sản phẩm này.',
          );
        }

        const existingAssignment = await tx.productJudgeAssignment.findUnique({
          where: {
            productId_judgeId: { productId, judgeId: judge.id },
          },
        });
        if (existingAssignment?.isActive) {
          throw new ConflictException(
            'Giám khảo này đã được phân công cho hồ sơ.',
          );
        }

        const existingEvaluation = await tx.evaluation.findUnique({
          where: {
            judgeId_productId: { judgeId: judge.id, productId },
          },
          include: {
            scores: { select: { subCriterionId: true } },
          },
        });

        if (
          existingEvaluation &&
          existingEvaluation.status === EvaluationStatus.EXCLUDED &&
          !input.confirmRestore
        ) {
          return {
            requiresRestoreConfirmation: true as const,
            previousEvaluation: {
              id: existingEvaluation.id,
              previousStatus:
                existingEvaluation.previousStatus ??
                EvaluationStatus.IN_PROGRESS,
              total: existingEvaluation.total,
              submittedAt:
                existingEvaluation.submittedAt?.toISOString() ?? null,
              excludedAt: existingEvaluation.excludedAt?.toISOString() ?? null,
              excludeReason: existingEvaluation.excludeReason,
              scoreCount: existingEvaluation.scores.length,
            },
          };
        }

        const now = new Date();
        const unit = judge.organizationUnit;
        let restoredStatus: EvaluationStatus | null = null;

        if (
          existingEvaluation &&
          existingEvaluation.status === EvaluationStatus.EXCLUDED
        ) {
          restoredStatus =
            existingEvaluation.previousStatus === EvaluationStatus.SUBMITTED
              ? EvaluationStatus.SUBMITTED
              : EvaluationStatus.IN_PROGRESS;
          await tx.evaluation.update({
            where: { id: existingEvaluation.id },
            data: {
              status: restoredStatus,
              previousStatus: null,
              excludedAt: null,
              excludedById: null,
              excludeReason: null,
            },
          });
          await tx.evaluationHistoryEvent.create({
            data: {
              evaluationId: existingEvaluation.id,
              action: EVALUATION_HISTORY_ACTION.RESTORED,
              fromStatus: EvaluationStatus.EXCLUDED,
              toStatus: restoredStatus,
              actorId,
              reason: input.reason,
              previousTotal: existingEvaluation.total,
            },
          });
        }

        const mustSubmitToComplete =
          restoredStatus !== EvaluationStatus.SUBMITTED;

        await tx.productJudgeAssignment.upsert({
          where: {
            productId_judgeId: { productId, judgeId: judge.id },
          },
          create: {
            productId,
            judgeId: judge.id,
            managingAgencyId: unit?.managingAgencyId ?? null,
            organizationUnitId: unit?.id ?? null,
            isManual: true,
            isActive: true,
            mustSubmitToComplete,
            assignedById: actorId,
            assignedAt: now,
          },
          update: {
            managingAgencyId: unit?.managingAgencyId ?? null,
            organizationUnitId: unit?.id ?? null,
            isManual: true,
            isActive: true,
            mustSubmitToComplete,
            assignedById: actorId,
            assignedAt: now,
            removedAt: null,
            removedById: null,
            removeReason: null,
          },
        });

        await recomputeProductResult(
          tx,
          productId,
          actorId,
          restoredStatus
            ? PRODUCT_RESULT_HISTORY_ACTION.JUDGE_RESTORED
            : PRODUCT_RESULT_HISTORY_ACTION.JUDGE_ADDED,
        );

        await this.audit(tx, {
          actorId,
          action: restoredStatus
            ? 'product.judge_restore'
            : 'product.judge_add',
          entityType: 'Product',
          entityId: productId,
          afterData: {
            judgeId: judge.id,
            restoredStatus,
            mustSubmitToComplete,
          },
          reason: input.reason,
          ...meta,
        });

        return { requiresRestoreConfirmation: false as const };
      },
      { timeout: 15000, maxWait: 10000 },
    );

    if (result.requiresRestoreConfirmation) {
      return result;
    }
    return this.adminProducts.findAdminProduct(productId, canManage);
  }

  async removeProductJudgeAssignment(
    productId: string,
    judgeId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true, status: true },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (product.categoryId !== initial.categoryId) {
          throw new ConflictException(
            'Product category changed while removing judge assignment',
          );
        }
        if (
          product.status !== ProductStatus.APPROVED &&
          product.status !== ProductStatus.SCORING &&
          product.status !== ProductStatus.COMPLETED
        ) {
          throw new ConflictException(
            'Chỉ có thể gỡ giám khảo khỏi hồ sơ đã duyệt hoặc đang chấm điểm.',
          );
        }

        const assignment = await tx.productJudgeAssignment.findUnique({
          where: { productId_judgeId: { productId, judgeId } },
        });
        if (!assignment || !assignment.isActive) {
          throw new NotFoundException('Phân công giám khảo không tồn tại');
        }

        const now = new Date();
        await tx.productJudgeAssignment.update({
          where: { id: assignment.id },
          data: {
            isActive: false,
            mustSubmitToComplete: false,
            removedAt: now,
            removedById: actorId,
            removeReason: reason ?? null,
          },
        });

        const existingEval = await tx.evaluation.findUnique({
          where: { judgeId_productId: { judgeId, productId } },
        });
        if (existingEval && existingEval.status !== EvaluationStatus.EXCLUDED) {
          await tx.evaluation.update({
            where: { id: existingEval.id },
            data: {
              previousStatus: existingEval.status,
              status: EvaluationStatus.EXCLUDED,
              excludedAt: now,
              excludedById: actorId,
              excludeReason: reason ?? null,
            },
          });
          await tx.evaluationHistoryEvent.create({
            data: {
              evaluationId: existingEval.id,
              action: EVALUATION_HISTORY_ACTION.EXCLUDED,
              fromStatus: existingEval.status,
              toStatus: EvaluationStatus.EXCLUDED,
              actorId,
              reason,
              previousTotal: existingEval.total,
            },
          });
        }

        await recomputeProductResult(
          tx,
          productId,
          actorId,
          PRODUCT_RESULT_HISTORY_ACTION.JUDGE_REMOVED,
        );

        await this.audit(tx, {
          actorId,
          action: 'product.judge_remove',
          entityType: 'Product',
          entityId: productId,
          beforeData: {
            judgeId,
            evaluationStatus: existingEval?.status ?? null,
          },
          afterData: {
            judgeId,
            isActive: false,
            evaluationExcluded: Boolean(existingEval),
          },
          reason,
          ...meta,
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return this.adminProducts.findAdminProduct(productId, canManage);
  }

  async reopenEvaluation(
    productId: string,
    evaluationId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );

        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (product.categoryId !== initial.categoryId) {
          throw new ConflictException(
            'Product category changed while reopening evaluation',
          );
        }

        const evaluation = await tx.evaluation.findFirst({
          where: { id: evaluationId, productId },
        });
        if (!evaluation) throw new NotFoundException('Evaluation not found');
        if (evaluation.status !== EvaluationStatus.SUBMITTED) {
          throw new ConflictException(
            'Chỉ có thể mở lại phiếu chấm đã nộp để giám khảo chỉnh sửa',
          );
        }

        const now = new Date();
        await tx.evaluation.update({
          where: { id: evaluation.id },
          data: {
            status: EvaluationStatus.IN_PROGRESS,
            reopenedAt: now,
            reopenedById: actorId,
            reopenReason: reason ?? null,
          },
        });

        await tx.evaluationHistoryEvent.create({
          data: {
            evaluationId: evaluation.id,
            action: EVALUATION_HISTORY_ACTION.REOPENED,
            fromStatus: EvaluationStatus.SUBMITTED,
            toStatus: EvaluationStatus.IN_PROGRESS,
            actorId,
            reason,
            previousTotal: evaluation.total,
          },
        });

        await recomputeProductResult(
          tx,
          productId,
          actorId,
          PRODUCT_RESULT_HISTORY_ACTION.EVALUATION_REOPENED,
        );

        await this.audit(tx, {
          actorId,
          action: 'evaluation.reopen',
          entityType: 'Evaluation',
          entityId: evaluation.id,
          beforeData: {
            productId,
            judgeId: evaluation.judgeId,
            status: EvaluationStatus.SUBMITTED,
            total: evaluation.total,
          },
          afterData: {
            productId,
            judgeId: evaluation.judgeId,
            status: EvaluationStatus.IN_PROGRESS,
          },
          reason,
          ...meta,
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return this.adminProducts.findAdminProduct(productId, canManage);
  }

  private audit(tx: Prisma.TransactionClient, input: AuditInput) {
    return writeAudit(tx, input);
  }
}
