import { EvaluationStatus, ProductStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { AdminProductQueryDto } from '../dtos/admin-products.dto';
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

describe('AdminService product filters', () => {
  it('passes the complete query through and returns filtered page metadata', async () => {
    const repository = {
      listProducts: jest.fn().mockResolvedValue({ data: [{ id: 'p-1' }], total: 3 }),
    };
    const service = new AdminService(repository as unknown as AdminRepository);
    const query = Object.assign(new AdminProductQueryDto(), {
      page: 2,
      limit: 1,
      status: ProductStatus.SUBMITTED,
      registrationType: 'FIRST',
      from: '2026-10-01T00:00:00+07:00',
      toExclusive: '2026-11-01T00:00:00+07:00',
    });

    await expect(service.listProducts(query, false)).resolves.toEqual({
      data: [{ id: 'p-1' }],
      meta: { page: 2, limit: 1, total: 3, totalPages: 3 },
    });
    expect(repository.listProducts).toHaveBeenCalledWith(query, false);
  });

  it.each([
    Object.assign(new AdminProductQueryDto(), { localityId: 'locality-1', unmappedLocality: true }),
    Object.assign(new AdminProductQueryDto(), { from: '2026-10-01T00:00:00Z' }),
    Object.assign(new AdminProductQueryDto(), { from: '2026-11-01T00:00:00Z', toExclusive: '2026-10-01T00:00:00Z' }),
    Object.assign(new AdminProductQueryDto(), { page: Number.MAX_SAFE_INTEGER, limit: 100 }),
  ])('rejects inconsistent or unsafe filter input', async (query) => {
    const repository = { listProducts: jest.fn() };
    const service = new AdminService(repository as unknown as AdminRepository);
    await expect(service.listProducts(query)).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.listProducts).not.toHaveBeenCalled();
  });
});
