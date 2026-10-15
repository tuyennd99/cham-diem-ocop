import { EvaluationStatus, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationsRepository } from './evaluations.repository';

describe('EvaluationsRepository.getEvaluation', () => {
  it('lets an assigned judge read their submitted evaluation after completion without exposing other criteria', async () => {
    const product = {
      id: 'product-1',
      status: ProductStatus.COMPLETED,
      categoryId: 'category-1',
      name: 'Sản phẩm OCOP',
      description: null,
      formData: {},
      category: {
        id: 'category-1',
        name: 'Thực phẩm',
        groupName: 'Nông sản',
        criteriaSet: {
          criteria: [
            { id: 'criterion-1', code: '1', name: 'Tiêu chí được giao', subCriteria: [] },
            { id: 'criterion-2', code: '2', name: 'Tiêu chí ngoài phạm vi', subCriteria: [] },
          ],
        },
      },
      attachments: [],
    };
    const database = {
      product: { findUnique: jest.fn().mockResolvedValue(product) },
      judgeAssignment: { findUnique: jest.fn().mockResolvedValue({ judgeId: 'judge-1', categoryId: 'category-1', criterionIds: ['criterion-1'] }) },
      evaluation: { findUnique: jest.fn().mockResolvedValue({ id: 'evaluation-1', status: EvaluationStatus.SUBMITTED, total: 12, scores: [] }) },
    };
    const repository = new EvaluationsRepository(database as unknown as PrismaService);

    const result = await repository.getEvaluation('judge-1', 'product-1');

    expect(result.evaluation.status).toBe(EvaluationStatus.SUBMITTED);
    expect(result.criteria.map(({ id }) => id)).toEqual(['criterion-1']);
    expect(result.product.category).toEqual({ id: 'category-1', name: 'Thực phẩm', groupName: 'Nông sản' });
    expect(result.product.category).not.toHaveProperty('criteriaSet');
  });
});
