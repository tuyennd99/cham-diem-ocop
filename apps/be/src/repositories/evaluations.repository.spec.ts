import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EvaluationStatus, ProductStatus } from '@prisma/client';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JudgeQueueQueryDto } from '../dtos/evaluations.dto';
import { PrismaService } from '../prisma/prisma.service';
import { openStoredFile } from '../utils/private-storage';
import { EvaluationsRepository } from './evaluations.repository';
import { recomputeProductResult } from '../utils/evaluation-result';

describe('EvaluationsRepository.getEvaluation', () => {
  it('stores a server-created fixed submission snapshot with assigned criteria and unit at submit time', async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://127.0.0.1/ocop_test?schema=ocop_test_unit';
    const unit = { id: 'unit-1', code: 'UNIT-1', name: 'Unit at submission' };
    const option = {
      id: 'option-1',
      label: 'Good',
      points: 75,
      subCriterionId: 'sub-1',
    };
    const criterion = {
      id: 'criterion-1',
      code: 'A',
      name: 'Quality',
      subCriteria: [{ id: 'sub-1', code: 'A.1', content: 'Craft' }],
    };
    const product = {
      id: 'product-1',
      name: 'Product',
      description: 'Description',
      formData: { entityName: 'Entity' },
      status: ProductStatus.SCORING,
      completedAt: null,
      categoryId: 'category-1',
      attachments: [],
      category: {
        id: 'category-1',
        name: 'Category',
        criteriaSet: {
          id: 'set-1',
          name: 'Criteria',
          source: 'official',
          version: 'v1',
          sourceHash: 'abc',
          criteria: [criterion],
        },
      },
    };
    const score = {
      subCriterionId: 'sub-1',
      note: 'Looks good',
      subCriterion: {
        ...criterion.subCriteria[0],
        criterionId: 'criterion-1',
        criterion: { id: 'criterion-1', code: 'A', name: 'Quality' },
      },
      option,
    };
    const assignment = {
      criterionIds: ['criterion-1'],
      judge: { id: 'judge-1', fullName: 'Judge', organizationUnit: unit },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        update: jest.fn(
          (_args: {
            where: unknown;
            data: {
              status: ProductStatus;
              finalScore: number;
              starRating: number;
              completedAt: Date;
            };
          }) => Promise.resolve({}),
        ),
      },
      productJudgeAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      judgeAssignment: {
        findUnique: jest.fn().mockResolvedValue(assignment),
        findMany: jest.fn().mockResolvedValue([assignment]),
      },
      evaluation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evaluation-1',
          status: EvaluationStatus.IN_PROGRESS,
          scores: [score],
        }),
        update: jest.fn(
          (_args: {
            data: {
              submittedAt: Date;
              submissionSnapshot: {
                version: number;
                submittedAt: string;
                product: {
                  id: string;
                  name: string;
                  category: { id: string; name: string };
                };
                criteriaSet: unknown;
              };
            };
          }) =>
            Promise.resolve({
              id: 'evaluation-1',
              total: 75,
              status: EvaluationStatus.SUBMITTED,
            }),
        ),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            judgeId: 'judge-1',
            status: EvaluationStatus.SUBMITTED,
            scores: [score],
          },
        ]),
      },
      evaluationHistoryEvent: { create: jest.fn().mockResolvedValue({}) },
      productStatusEvent: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: null } }),
        create: jest.fn(),
      },
    };
    const repository = new EvaluationsRepository({
      $transaction: (run: (database: typeof tx) => unknown) => run(tx),
    } as unknown as PrismaService);

    try {
      await repository.submit('judge-1', 'product-1');
      const update = tx.evaluation.update.mock.calls[0]?.[0];
      expect(update).toBeDefined();
      const snapshot = update.data.submissionSnapshot;
      expect(update.data.submittedAt).toBeInstanceOf(Date);
      expect(snapshot.product.category).toEqual({
        id: 'category-1',
        name: 'Category',
      });
      expect(snapshot).toMatchObject({
        version: 2,
        submittedAt: update.data.submittedAt.toISOString(),
        product: {
          id: 'product-1',
          name: 'Product',
          category: { id: 'category-1' },
        },
        criteriaSet: {
          id: 'set-1',
          source: 'official',
          version: 'v1',
          sourceHash: 'abc',
        },
        judge: { id: 'judge-1', fullName: 'Judge', organizationUnit: unit },
        assignedCriterionIds: ['criterion-1'],
        scores: [
          {
            criterion: { id: 'criterion-1', code: 'A', name: 'Quality' },
            subCriterion: { id: 'sub-1', code: 'A.1', content: 'Craft' },
            option,
            note: 'Looks good',
          },
        ],
        total: 75,
      });
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('allows submitting an evaluation when some assigned subcriteria are omitted', async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://127.0.0.1/ocop_test?schema=ocop_test_unit';
    const unit = { id: 'unit-1', code: 'UNIT-1', name: 'Unit 1' };
    const option = {
      id: 'option-1',
      label: 'Good',
      points: 40,
      subCriterionId: 'sub-1',
    };
    const criterion = {
      id: 'criterion-1',
      code: 'A',
      name: 'Quality',
      subCriteria: [
        { id: 'sub-1', code: 'A.1', content: 'Craft' },
        { id: 'sub-2', code: 'A.2', content: 'Origin' },
      ],
    };
    const product = {
      id: 'product-1',
      name: 'Product',
      description: 'Description',
      formData: { entityName: 'Entity' },
      status: ProductStatus.SCORING,
      completedAt: null,
      categoryId: 'category-1',
      attachments: [],
      category: {
        id: 'category-1',
        name: 'Category',
        criteriaSet: {
          id: 'set-1',
          name: 'Criteria',
          source: 'official',
          version: 'v1',
          sourceHash: 'abc',
          criteria: [criterion],
        },
      },
    };
    const score = {
      subCriterionId: 'sub-1',
      note: null,
      subCriterion: {
        ...criterion.subCriteria[0],
        criterionId: 'criterion-1',
        criterion: { id: 'criterion-1', code: 'A', name: 'Quality' },
      },
      option,
    };
    const assignment = {
      criterionIds: ['criterion-1'],
      judge: { id: 'judge-1', fullName: 'Judge', organizationUnit: unit },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: {
        findUnique: jest.fn().mockResolvedValue(product),
        update: jest.fn().mockResolvedValue({}),
      },
      productJudgeAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      judgeAssignment: {
        findUnique: jest.fn().mockResolvedValue(assignment),
        findMany: jest.fn().mockResolvedValue([assignment]),
      },
      evaluation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evaluation-1',
          total: 0,
          status: EvaluationStatus.IN_PROGRESS,
          scores: [score],
        }),
        update: jest.fn().mockResolvedValue({
          id: 'evaluation-1',
          total: 40,
          status: EvaluationStatus.SUBMITTED,
        }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            judgeId: 'judge-1',
            status: EvaluationStatus.SUBMITTED,
            scores: [score],
          },
        ]),
      },
      evaluationHistoryEvent: { create: jest.fn().mockResolvedValue({}) },
      productStatusEvent: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: null } }),
        create: jest.fn(),
      },
    };
    const repository = new EvaluationsRepository({
      $transaction: (run: (database: typeof tx) => unknown) => run(tx),
    } as unknown as PrismaService);

    try {
      const submitted = await repository.submit('judge-1', 'product-1');

      expect(submitted).toMatchObject({
        id: 'evaluation-1',
        total: 40,
        status: EvaluationStatus.SUBMITTED,
      });
      const updateCalls = tx.evaluation.update.mock.calls as Array<
        Array<{
          data: {
            submissionSnapshot: {
              scores: Array<{ subCriterion: { id: string } }>;
            };
          };
        }>
      >;
      const update = updateCalls[0]?.[0];
      expect(update?.data.submissionSnapshot.scores).toHaveLength(1);
      expect(update?.data.submissionSnapshot.scores[0]?.subCriterion.id).toBe(
        'sub-1',
      );
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

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
        criteriaSet: {
          criteria: [
            {
              id: 'criterion-1',
              code: '1',
              name: 'Tiêu chí được giao',
              subCriteria: [],
            },
            {
              id: 'criterion-2',
              code: '2',
              name: 'Tiêu chí ngoài phạm vi',
              subCriteria: [],
            },
          ],
        },
      },
      attachments: [],
    };
    const database = {
      product: { findUnique: jest.fn().mockResolvedValue(product) },
      productJudgeAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      judgeAssignment: {
        findUnique: jest.fn().mockResolvedValue({
          judgeId: 'judge-1',
          categoryId: 'category-1',
          criterionIds: ['criterion-1'],
        }),
      },
      evaluation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'evaluation-1',
          status: EvaluationStatus.SUBMITTED,
          total: 12,
          scores: [],
        }),
      },
    };
    const repository = new EvaluationsRepository(
      database as unknown as PrismaService,
    );

    const result = await repository.getEvaluation('judge-1', 'product-1');

    expect(result.evaluation.status).toBe(EvaluationStatus.SUBMITTED);
    expect(result.criteria.map(({ id }) => id)).toEqual(['criterion-1']);
    expect(result.product.category).toEqual({
      id: 'category-1',
      name: 'Thực phẩm',
    });
    expect(result.product.category).not.toHaveProperty('criteriaSet');
  });

  it('recomputeProductResult filters assignments to active judges only', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          status: ProductStatus.SCORING,
          completedAt: null,
          categoryId: 'category-1',
          category: {
            criteriaSet: {
              criteria: [{ id: 'criterion-1', subCriteria: [{ id: 'sub-1' }] }],
            },
          },
        }),
        update: jest.fn(
          (_args: {
            where: unknown;
            data: {
              status: ProductStatus;
              finalScore: number;
              starRating: number;
              completedAt: Date;
            };
          }) => Promise.resolve({}),
        ),
      },
      productStatusEvent: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: null } }),
        create: jest.fn(),
      },
      judgeAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ judgeId: 'judge-1', criterionIds: [] }]),
      },
      productJudgeAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
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

    await recomputeProductResult(tx as never, 'product-1', 'judge-1');

    expect(tx.judgeAssignment.findMany).toHaveBeenCalledWith({
      where: {
        categoryId: 'category-1',
        judge: {
          is: {
            role: { not: 'REGISTRANT' },
            staffPermissions: { has: 'SCORE' },
            isActive: true,
            verified: true,
          },
        },
      },
      select: { judgeId: true, criterionIds: true },
    });
    const update = tx.product.update.mock.calls[0]?.[0];
    expect(update).toMatchObject({
      where: { id: 'product-1' },
      data: { status: ProductStatus.COMPLETED, finalScore: 90, starRating: 5 },
    });
    expect(update?.data.completedAt).toBeInstanceOf(Date);
    expect(tx.productStatusEvent.create).toHaveBeenCalledWith({
      data: {
        productId: 'product-1',
        fromStatus: ProductStatus.SCORING,
        toStatus: ProductStatus.COMPLETED,
        actorId: 'judge-1',
        createdAt: update?.data.completedAt,
        sequence: 1,
      },
    });
  });

  it('leaves a completed legacy product and unknown completion date untouched', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          status: ProductStatus.COMPLETED,
          completedAt: null,
        }),
        update: jest.fn(),
      },
      productJudgeAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      productStatusEvent: { aggregate: jest.fn(), create: jest.fn() },
    };

    await recomputeProductResult(tx as never, 'product-1', 'judge-1');

    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.productStatusEvent.create).not.toHaveBeenCalled();
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
      await expect(
        openStoredFile('../secret', 'a.pdf', dir),
      ).rejects.toBeInstanceOf(ForbiddenException);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('EvaluationsRepository.listQueue', () => {
  it('defaults to updatedAt DESC ordering, returns summary counts and real attachmentCount', async () => {
    const row = {
      id: 'prod-1',
      codeNumber: 12,
      name: 'Mật ong rừng tràm',
      description: 'Mô tả',
      status: ProductStatus.SCORING,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-11-18T12:00:00.000Z'),
      category: { id: 'cat-1', name: 'Mật ong' },
      attachments: [{ id: 'att-1', fileName: 'photo.jpg' }],
      _count: { attachments: 4 },
      evaluations: [{ status: EvaluationStatus.IN_PROGRESS, total: null }],
    };
    const tx = {
      product: {
        count: jest
          .fn()
          .mockResolvedValueOnce(9)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(0),
        findMany: jest.fn().mockResolvedValue([row]),
      },
    };
    const prisma = {
      $transaction: jest.fn((run: (database: typeof tx) => unknown) => run(tx)),
    } as unknown as PrismaService;
    const repository = new EvaluationsRepository(prisma);

    const query = Object.assign(new JudgeQueueQueryDto(), {
      page: 1,
      limit: 10,
    });
    const result = await repository.listQueue('judge-1', query);

    expect(tx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 10,
      }),
    );
    expect(result.total).toBe(9);
    expect(result.counts).toEqual({
      total: 9,
      open: 4,
      submitted: 5,
      excluded: 0,
    });
    expect(result.data[0]).toMatchObject({
      id: 'prod-1',
      code: 'OCOP-000012',
      attachmentCount: 4,
    });
  });

  it('filters IN_PROGRESS status and computes total from open count', async () => {
    const tx = {
      product: {
        count: jest
          .fn()
          .mockResolvedValueOnce(9)
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      $transaction: jest.fn((run: (database: typeof tx) => unknown) => run(tx)),
    } as unknown as PrismaService;
    const repository = new EvaluationsRepository(prisma);

    const query = Object.assign(new JudgeQueueQueryDto(), {
      page: 1,
      limit: 10,
      evaluationStatus: EvaluationStatus.IN_PROGRESS,
      sortBy: 'name',
      sortDirection: 'asc',
    });
    const result = await repository.listQueue('judge-1', query);

    expect(result.counts).toEqual({
      total: 9,
      open: 3,
      submitted: 5,
      excluded: 1,
    });
    expect(result.total).toBe(3);
    expect(tx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('rejects saveDraft and submit with 409 ConflictException when versionToken is stale', async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://127.0.0.1/ocop_test?schema=ocop_test_unit';
    try {
      const product = {
        id: 'product-1',
        status: ProductStatus.SCORING,
        categoryId: 'category-1',
        category: {
          id: 'category-1',
          name: 'Category',
          criteriaSet: {
            id: 'set-1',
            name: 'Criteria',
            source: 'official',
            version: 'v1',
            sourceHash: 'abc',
            criteria: [
              {
                id: 'criterion-1',
                code: 'A',
                name: 'Quality',
                subCriteria: [
                  {
                    id: 'sub-1',
                    code: 'A.1',
                    content: 'Craft',
                    options: [{ id: 'option-1', label: 'Good', points: 75 }],
                  },
                ],
              },
            ],
          },
        },
      };
      const db = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        product: { findUnique: jest.fn().mockResolvedValue(product) },
        productJudgeAssignment: {
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        judgeAssignment: {
          findUnique: jest.fn().mockResolvedValue({
            criterionIds: ['criterion-1'],
            judge: {
              id: 'judge-1',
              fullName: 'Judge',
              organizationUnit: null,
            },
          }),
        },
        evaluation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'evaluation-1',
            status: EvaluationStatus.IN_PROGRESS,
            scores: [
              {
                subCriterionId: 'sub-1',
                optionId: 'option-1',
                note: 'initial',
              },
            ],
          }),
        },
      };
      const prisma = {
        ...db,
        $transaction: (run: (tx: typeof db) => unknown) => run(db),
      } as unknown as PrismaService;
      const repository = new EvaluationsRepository(prisma);

      const loaded = await repository.getEvaluation('judge-1', 'product-1');
      expect(loaded.evaluation.versionToken).toMatch(/^[0-9a-f]{64}$/);

      await expect(
        repository.saveDraft(
          'judge-1',
          'product-1',
          [{ subCriterionId: 'sub-1', optionId: 'option-1', note: 'edited' }],
          'stale-version-token',
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        repository.submit('judge-1', 'product-1', 'stale-version-token'),
      ).rejects.toThrow(ConflictException);
    } finally {
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
