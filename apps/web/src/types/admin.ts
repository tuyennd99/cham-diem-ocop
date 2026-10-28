import type {
  AdminAnalyticsDashboardResponse,
  AdminProductListItem,
  AdminProductDetail as SharedAdminProductDetail,
  AdminProductQuery as SharedAdminProductQuery,
  Criterion as SharedCriterion,
  StaffPermission,
} from '@ocop/shared';
import type { Category as ProductCategoryView } from './product';

export interface AdminJudge {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  verified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreateJudgeInput {
  email: string;
  fullName: string;
  password: string;
  phone?: string;
}
export interface UpdateJudgeInput {
  fullName?: string;
  phone?: string | null;
}
export interface ResetJudgePasswordInput {
  password: string;
}
export type DeactivatedJudge = Pick<AdminJudge, 'id' | 'email' | 'fullName' | 'isActive'>;
export interface AssignmentInput {
  judgeId: string;
  categoryId: string;
  criterionIds: string[];
}

export type AdminCategory = ProductCategoryView & {
  criteriaSet?: { criteria: SharedCriterion[] } | null;
};

export interface Assignment {
  judgeId: string;
  categoryId: string;
  criterionIds: string[];
  judge: Pick<AdminJudge, 'id' | 'email' | 'fullName' | 'isActive'>;
  category: Pick<AdminCategory, 'id' | 'name'>;
}

export type AdminProduct = AdminProductListItem;
export type AdminProductDetail = SharedAdminProductDetail;
export type AdminProductQuery = SharedAdminProductQuery;

export type AdminDashboard = AdminAnalyticsDashboardResponse;

export interface ProductResults {
  id: string;
  name: string;
  status: string;
  finalScore: number | null;
  starRating: number | null;
  category: AdminCategory;
  evaluations: {
    id?: string;
    judge: { id: string; fullName: string; email: string };
    status: string;
    total: number | null;
    scores: {
      option: { label: string; points: number };
      note: string | null;
      subCriterion: { code: string; criterion: { code: string; name: string } };
    }[];
  }[];
}

export interface UpdateAdminUserStaffAccessInput {
  staffPermissions: StaffPermission[];
  organizationUnitId: string | null;
  reason: string;
}
