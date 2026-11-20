import {
  ADMIN_CRITERIA_SET_SORT_BY,
  ADMIN_EVALUATION_SORT_BY,
  JUDGE_QUEUE_SORT_BY,
  PRODUCT_DATE_BASIS,
  PRODUCT_SORT_BY,
  SORT_DIRECTION,
} from '../constants/products';
import { PrismaService } from '../prisma/prisma.service';
import { AdminProductsRepository } from './admin/admin-products.repository';
import { AdminScoringRepository } from './admin/admin-scoring.repository';
import { EvaluationsRepository } from './evaluations.repository';
import { ProductsRepository } from './products.repository';

function mockProductRepos() {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const groupBy = jest.fn().mockResolvedValue([]);
  const prisma: Record<string, unknown> = {
    product: { findMany, count, groupBy },
    $transaction: jest.fn(async (arg: unknown): Promise<unknown> =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };
  return {
    prisma: prisma as unknown as PrismaService,
    findMany,
  };
}

describe('Business list sorting (#55)', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://127.0.0.1/ocop_test?schema=public';
  });

  afterEach(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });
  it('keeps public catalog fixed at createdAt DESC, id DESC and uses orderBy maps for listMine and AdminProductsRepository', async () => {
    const { prisma, findMany } = mockProductRepos();
    const productsRepo = new ProductsRepository(prisma);
    const adminProductsRepo = new AdminProductsRepository(prisma);

    await productsRepo.listPublic({ page: 1, limit: 12 });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );

    await productsRepo.listMine('owner-1', {
      page: 1,
      limit: 20,
      dateBasis: PRODUCT_DATE_BASIS.SUBMITTED_AT,
    });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
    );

    await productsRepo.listMine('owner-1', {
      page: 1,
      limit: 20,
      dateBasis: PRODUCT_DATE_BASIS.SUBMITTED_AT,
      sortDirection: SORT_DIRECTION.ASC,
    });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      }),
    );

    await productsRepo.listMine('owner-1', {
      page: 1,
      limit: 20,
      dateBasis: PRODUCT_DATE_BASIS.SUBMITTED_AT,
      sortBy: PRODUCT_SORT_BY.FINAL_SCORE,
      sortDirection: SORT_DIRECTION.ASC,
    });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [
          { finalScore: { sort: 'asc', nulls: 'last' } },
          { id: 'asc' },
        ],
      }),
    );

    await adminProductsRepo.listProducts({
      page: 1,
      limit: 20,
      dateBasis: PRODUCT_DATE_BASIS.SUBMITTED_AT,
    });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [
          { submittedAt: { sort: 'desc', nulls: 'last' } },
          { id: 'desc' },
        ],
      }),
    );

    await adminProductsRepo.listProducts({
      page: 1,
      limit: 20,
      dateBasis: PRODUCT_DATE_BASIS.SUBMITTED_AT,
      sortBy: PRODUCT_SORT_BY.NAME,
      sortDirection: SORT_DIRECTION.ASC,
    });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('sorts criteria sets by maxScore across all matching rows before slicing pagination and maps evaluation orderBy', async () => {
    const criteriaSetFindMany = jest.fn().mockResolvedValue([
      {
        id: 'cs-1',
        name: 'Set 1',
        source: null,
        version: 'v1',
        sourceHash: 'h1',
        isActive: true,
        category: { id: 'c-1', name: 'Beta', order: 1 },
        criteria: [{ maxScore: 50 }],
        _count: { criteria: 1 },
      },
      {
        id: 'cs-2',
        name: 'Set 2',
        source: null,
        version: 'v1',
        sourceHash: 'h2',
        isActive: true,
        category: { id: 'c-2', name: 'Alpha', order: 2 },
        criteria: [{ maxScore: 100 }],
        _count: { criteria: 1 },
      },
      {
        id: 'cs-3',
        name: 'Set 3',
        source: null,
        version: 'v1',
        sourceHash: 'h3',
        isActive: true,
        category: { id: 'c-3', name: 'Gamma', order: 3 },
        criteria: [{ maxScore: 100 }],
        _count: { criteria: 1 },
      },
    ]);
    const evalFindMany = jest.fn().mockResolvedValue([]);
    const queryRaw = jest.fn<
      Promise<Array<{ id: string }>>,
      [{ strings?: readonly string[] }]
    >(() => Promise.resolve([{ id: 'ev-2' }, { id: 'ev-1' }]));
    const prisma: Record<string, unknown> = {
      criteriaSet: {
        findMany: criteriaSetFindMany,
        count: jest.fn().mockResolvedValue(3),
      },
      evaluation: {
        findMany: evalFindMany,
        count: jest.fn().mockResolvedValue(2),
      },
      score: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: queryRaw,
      $transaction: jest.fn(async (arg: unknown): Promise<unknown> =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    const repo = new AdminScoringRepository(prisma as unknown as PrismaService);

    const page2 = await repo.listCriteriaSets(
      {
        page: 2,
        limit: 1,
        sortBy: ADMIN_CRITERIA_SET_SORT_BY.MAX_SCORE,
        sortDirection: SORT_DIRECTION.DESC,
      },
      { canViewAll: true },
    );
    expect(criteriaSetFindMany).toHaveBeenCalledTimes(1);
    expect(
      (
        criteriaSetFindMany.mock.calls as Array<[Record<string, unknown>]>
      )[0]?.[0],
    ).not.toHaveProperty('skip');
    expect(page2.data.map((row) => row.id)).toEqual(['cs-3']);
    expect(page2.total).toBe(3);

    await repo.listEvaluations(
      {
        page: 1,
        limit: 20,
        sortDirection: SORT_DIRECTION.ASC,
      },
      { canManage: true, canView: true, scorerUserId: 'admin-1' },
    );
    expect(evalFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [
          { submittedAt: { sort: 'desc', nulls: 'last' } },
          { updatedAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    );

    await repo.listEvaluations(
      {
        page: 1,
        limit: 20,
        sortBy: ADMIN_EVALUATION_SORT_BY.SCOPE,
        sortDirection: SORT_DIRECTION.DESC,
      },
      { canManage: true, canView: true, scorerUserId: 'admin-1' },
    );
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sqlText = queryRaw.mock.calls[0]?.[0]?.strings?.join(' ') ?? '';
    expect(sqlText).toContain('ORDER BY');
    expect(sqlText).toContain('DESC');
  });

  it('uses prebuilt SQL order expressions for evalStatus/totalScore and Prisma orderBy for other judge queue sorts', async () => {
    const productFindMany = jest.fn().mockResolvedValue([]);
    const productCount = jest.fn().mockResolvedValue(0);
    const queryRaw = jest.fn<
      Promise<Array<{ id: string }>>,
      [{ strings?: readonly string[] }]
    >(() => Promise.resolve([]));
    const prisma: Record<string, unknown> = {
      product: { findMany: productFindMany, count: productCount },
      $queryRaw: queryRaw,
      $transaction: jest.fn(async (arg: unknown): Promise<unknown> =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    const repo = new EvaluationsRepository(prisma as unknown as PrismaService);

    await repo.listQueue('judge-1', {
      page: 1,
      limit: 20,
      sortBy: JUDGE_QUEUE_SORT_BY.EVAL_STATUS,
      sortDirection: SORT_DIRECTION.ASC,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const evalStatusSql = queryRaw.mock.calls[0]?.[0]?.strings?.join(' ') ?? '';
    expect(evalStatusSql).toContain(
      'COALESCE(e."status"::text, \'IN_PROGRESS\')',
    );

    await repo.listQueue('judge-1', {
      page: 1,
      limit: 20,
      sortBy: JUDGE_QUEUE_SORT_BY.ATTACHMENTS,
      sortDirection: SORT_DIRECTION.DESC,
    });
    expect(productFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [
          { attachments: { _count: 'desc' } },
          { updatedAt: 'desc' },
          { id: 'desc' },
        ],
      }),
    );
  });
});
