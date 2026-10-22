import { EvaluationStatus, ProductStatus } from '@prisma/client';
import { AdminRepository } from '../repositories/admin.repository';
import { AdminService } from './admin.service';

describe('AdminService dashboard', () => {
  it('returns real status counts and judge/product work progress', async () => {
    const repository = {
      dashboardData: jest.fn().mockResolvedValue({
        productStatuses: [
          { status: ProductStatus.SUBMITTED, _count: { _all: 2 } },
          { status: ProductStatus.COMPLETED, _count: { _all: 1 } },
        ],
        judgeProgress: [{ judgeId: 'judge-1', fullName: 'Nguyễn An', assigned: 3, submitted: 1 }],
        nextProducts: [{
          id: 'product-1',
          name: 'Sản phẩm OCOP',
          status: ProductStatus.SUBMITTED,
          submittedAt: new Date('2026-10-01T00:00:00.000Z'),
          category: {
            id: 'category-1',
            name: 'Thực phẩm',
            groupName: 'Nông sản',
            assignments: [{ judgeId: 'judge-1' }, { judgeId: 'judge-2' }],
          },
          evaluations: [
            { judgeId: 'judge-1', status: EvaluationStatus.SUBMITTED },
            { judgeId: 'judge-2', status: EvaluationStatus.IN_PROGRESS },
          ],
        }],
      }),
    };
    const service = new AdminService(repository as unknown as AdminRepository);

    await expect(service.dashboard()).resolves.toEqual({
      productsByStatus: {
        DRAFT: 0,
        SUBMITTED: 2,
        SCORING: 0,
        COMPLETED: 1,
      },
      judges: [{ judgeId: 'judge-1', fullName: 'Nguyễn An', assigned: 3, submitted: 1, pending: 2 }],
      needsAttention: [{
        id: 'product-1',
        name: 'Sản phẩm OCOP',
        status: ProductStatus.SUBMITTED,
        submittedAt: new Date('2026-10-01T00:00:00.000Z'),
        category: {
          id: 'category-1',
          name: 'Thực phẩm',
          groupName: 'Nông sản',
        },
        assignedJudgeCount: 2,
        submittedEvaluationCount: 1,
        pendingEvaluationCount: 1,
      }],
    });
  });
});
