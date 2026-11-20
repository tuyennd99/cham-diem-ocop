import { Injectable } from '@nestjs/common';
import type { AdminReportFilterQuery } from '@ocop/shared';
import type {
  AddProductJudgeAssignmentDto,
  AdminProductQueryDto,
} from '../dtos/admin-products.dto';
import type {
  AdminCriteriaSetsQueryDto,
  AdminEvaluationsQueryDto,
} from '../dtos/admin-scoring.dto';
import type { UpdateStaffAccessDto } from '../dtos/admin.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAnalyticsRepository } from './admin/admin-analytics.repository';
import { AdminAssignmentsRepository } from './admin/admin-assignments.repository';
import { AdminProductsRepository } from './admin/admin-products.repository';
import { AdminScoringRepository } from './admin/admin-scoring.repository';
import type { AdminRequestMeta } from './admin/admin-shared';

export type { AdminRequestMeta };

@Injectable()
export class AdminRepository {
  private readonly products: AdminProductsRepository;
  private readonly assignments: AdminAssignmentsRepository;
  private readonly scoring: AdminScoringRepository;
  private readonly analytics: AdminAnalyticsRepository;

  constructor(private readonly prisma: PrismaService) {
    this.products = new AdminProductsRepository(this.prisma);
    this.assignments = new AdminAssignmentsRepository(
      this.prisma,
      this.products,
    );
    this.scoring = new AdminScoringRepository(this.prisma);
    this.analytics = new AdminAnalyticsRepository(this.prisma);
  }

  listJudges() {
    return this.assignments.listJudges();
  }

  listEligibleJudgesForProduct(productId: string) {
    return this.assignments.listEligibleJudgesForProduct(productId);
  }

  dashboardData(canManage = true, queuePage?: number, queueSearch = '') {
    return this.analytics.dashboardData(canManage, queuePage, queueSearch);
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
    return this.assignments.createJudge(input, actorId, meta);
  }

  updateJudge(args: {
    id: string;
    input: { fullName?: string; phone?: string | null; reason: string };
    actorId: string;
    meta: AdminRequestMeta;
  }) {
    return this.assignments.updateJudge(args);
  }

  deactivateJudge(
    id: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.assignments.deactivateJudge(id, reason, actorId, meta);
  }

  resetJudgePassword(
    id: string,
    password: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.assignments.resetJudgePassword(
      id,
      password,
      reason,
      actorId,
      meta,
    );
  }

  updateStaffAccess(
    id: string,
    input: UpdateStaffAccessDto,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.assignments.updateStaffAccess(id, input, actorId, meta);
  }

  listAssignments() {
    return this.assignments.listAssignments();
  }

  replaceAssignments(
    assignments: Array<{
      judgeId: string;
      categoryId: string;
      criterionIds: string[];
    }>,
    actorId: string,
    reason: string | undefined,
    meta: AdminRequestMeta,
  ) {
    return this.assignments.replaceAssignments(
      assignments,
      actorId,
      reason,
      meta,
    );
  }

  listProducts(query: AdminProductQueryDto, canManage = true) {
    return this.products.listProducts(query, canManage);
  }

  findAdminProduct(id: string, canManage = true) {
    return this.products.findAdminProduct(id, canManage);
  }

  findAdminAttachments(productId: string, canManage = true) {
    return this.products.findAdminAttachments(productId, canManage);
  }

  approveProduct(
    productId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    return this.products.approveProduct(
      productId,
      reason,
      actorId,
      meta,
      canManage,
    );
  }

  returnProduct(
    productId: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    return this.products.returnProduct(
      productId,
      reason,
      actorId,
      meta,
      canManage,
    );
  }

  publishProductResults(
    productId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    return this.products.publishProductResults(
      productId,
      reason,
      actorId,
      meta,
      canManage,
    );
  }

  reopenProduct(
    productId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    return this.products.reopenProduct(
      productId,
      reason,
      actorId,
      meta,
      canManage,
    );
  }

  addProductJudgeAssignment(
    productId: string,
    input: AddProductJudgeAssignmentDto,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    return this.assignments.addProductJudgeAssignment(
      productId,
      input,
      actorId,
      meta,
      canManage,
    );
  }

  removeProductJudgeAssignment(
    productId: string,
    judgeId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    return this.assignments.removeProductJudgeAssignment(
      productId,
      judgeId,
      reason,
      actorId,
      meta,
      canManage,
    );
  }

  reopenEvaluation(
    productId: string,
    evaluationId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    return this.assignments.reopenEvaluation(
      productId,
      evaluationId,
      reason,
      actorId,
      meta,
      canManage,
    );
  }

  productResults(productId: string, canManage = true) {
    return this.products.productResults(productId, canManage);
  }

  listCriteriaSets(
    query: AdminCriteriaSetsQueryDto,
    access: { canViewAll: boolean; scorerUserId?: string },
  ) {
    return this.scoring.listCriteriaSets(query, access);
  }

  findCriteriaSetDetail(
    id: string,
    access: { canViewAll: boolean; scorerUserId?: string },
  ) {
    return this.scoring.findCriteriaSetDetail(id, access);
  }

  findCriteriaSetPrintData(
    id: string,
    access: { canViewAll: boolean; scorerUserId?: string },
  ) {
    return this.scoring.findCriteriaSetPrintData(id, access);
  }

  listEvaluations(
    query: AdminEvaluationsQueryDto,
    access: { canManage: boolean; canView: boolean; scorerUserId: string },
  ) {
    return this.scoring.listEvaluations(query, access);
  }

  findEvaluationPrintData(
    evaluationId: string,
    access: { canManage: boolean; canView: boolean; scorerUserId: string },
  ) {
    return this.scoring.findEvaluationPrintData(evaluationId, access);
  }

  findProductRegistrationPrintData(
    productId: string,
    access: { canManage: boolean; canView: boolean; registrantId?: string },
  ) {
    return this.scoring.findProductRegistrationPrintData(productId, access);
  }

  findProductResultsPrintData(
    productId: string,
    access: { canManage: boolean; canView: boolean; registrantId?: string },
  ) {
    return this.scoring.findProductResultsPrintData(productId, access);
  }

  reportingSnapshot(filters?: AdminReportFilterQuery) {
    return this.analytics.reportingSnapshot(filters);
  }
}
