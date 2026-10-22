import { ForbiddenException } from '@nestjs/common';
import { EvaluationStatus, ProductStatus } from '@prisma/client';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { openStoredFile } from '../utils/private-storage';
import { EvaluationsRepository } from './evaluations.repository';
import { recomputeProductResult } from '../utils/evaluation-result';

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

  it('recomputeProductResult filters assignments to active judges only', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          status: ProductStatus.SCORING,
          categoryId: 'category-1',
          category: {
            criteriaSet: {
              criteria: [{ id: 'criterion-1', subCriteria: [{ id: 'sub-1' }] }],
            },
          },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      judgeAssignment: {
        findMany: jest.fn().mockResolvedValue([{ judgeId: 'judge-1', criterionIds: [] }]),
      },
      evaluation: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            judgeId: 'judge-1',
            status: EvaluationStatus.SUBMITTED,
            scores: [
              {
                subCriterionId: 'sub-1',
                subCriterion: { id: 'sub-1', criterionId: 'criterion-1' },
                option: { subCriterionId: 'sub-1', points: 90 },
              },
            ],
          },
        ]),
      },
    };

    await recomputeProductResult(tx as never, 'product-1');

    expect(tx.judgeAssignment.findMany).toHaveBeenCalledWith({
      where: { categoryId: 'category-1', judge: { is: { role: { not: 'REGISTRANT' }, staffPermissions: { has: 'SCORE' }, isActive: true, verified: true } } },
      select: { judgeId: true, criterionIds: true },
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        status: ProductStatus.COMPLETED,
        finalScore: 90,
        starRating: 5,
      },
    });
  });

  it('openStoredFile validates UUID key and returns stream metadata', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ocop-file-'));
    const key = '0195f000-0000-7000-8000-000000000001';
    try {
      writeFileSync(join(dir, key), 'pdf-bytes');
      const file = await openStoredFile(key, 'evidence.PDF', dir);
      await new Promise<void>((resolve) => {
        file.stream.once('close', () => resolve());
        file.stream.destroy();
      });
      expect(file.originalName).toBe('evidence.PDF');
      expect(file.mimeType).toBe('application/pdf');
      expect(file.sizeBytes).toBe(9);
      await expect(openStoredFile('../secret', 'a.pdf', dir)).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
