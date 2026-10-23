import type {
  Criterion as SharedCriterion,
  Product as SharedProduct,
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
  groupCode: string;
  criteriaSet?: { criteria: SharedCriterion[] } | null;
};

export interface Assignment {
  judgeId: string;
  categoryId: string;
  criterionIds: string[];
  judge: Pick<AdminJudge, 'id' | 'email' | 'fullName' | 'isActive'>;
  category: Pick<AdminCategory, 'id' | 'name' | 'groupCode' | 'groupName'>;
}

export type AdminProduct = Pick<
  SharedProduct,
  'id' | 'name' | 'status' | 'finalScore' | 'starRating' | 'createdAt' | 'category'
> & {
  status: string;
  finalScore: number | null;
  starRating: number | null;
  createdAt: string;
  category: AdminCategory;
  registrant: { id: string; fullName: string; email: string };
  evaluations: { judgeId: string; status: string; total: number | null }[];
};

export interface AdminDashboard {
  productsByStatus: Record<'DRAFT' | 'SUBMITTED' | 'SCORING' | 'COMPLETED', number>;
  judges: {
    judgeId: string;
    fullName: string;
    assigned: number;
    submitted: number;
    pending: number;
  }[];
  needsAttention: {
    id: string;
    name: string;
    status: 'SUBMITTED' | 'SCORING';
    submittedAt: string | null;
    category: { id: string; name: string; groupName: string };
    assignedJudgeCount: number;
    submittedEvaluationCount: number;
    pendingEvaluationCount: number;
  }[];
}

export interface ProductResults {
  id: string;
  name: string;
  status: string;
  finalScore: number | null;
  starRating: number | null;
  category: AdminCategory;
  evaluations: {
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
