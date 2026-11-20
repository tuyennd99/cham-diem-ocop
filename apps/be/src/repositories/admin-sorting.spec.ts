import {
  ADMIN_CATEGORY_SORT_BY,
  ADMIN_USER_SORT_BY,
  LOCALITY_SORT_BY,
  ORGANIZATION_UNIT_SORT_BY,
  SORT_DIRECTION,
} from '../constants/products';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCatalogsRepository } from './admin-catalogs.repository';
import { AdminUsersRepository } from './admin-users.repository';

function mockPrisma() {
  const userFindMany = jest.fn().mockResolvedValue([]);
  const unitFindMany = jest.fn().mockResolvedValue([]);
  const localityFindMany = jest.fn().mockResolvedValue([]);
  const categoryFindMany = jest.fn().mockResolvedValue([]);

  const prisma: Record<string, unknown> = {
    user: { findMany: userFindMany, count: jest.fn().mockResolvedValue(0) },
    organizationUnit: {
      findMany: unitFindMany,
      count: jest.fn().mockResolvedValue(0),
    },
    locality: {
      findMany: localityFindMany,
      count: jest.fn().mockResolvedValue(0),
    },
    productCategory: {
      findMany: categoryFindMany,
      count: jest.fn().mockResolvedValue(0),
    },
    product: { groupBy: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (arg: unknown): Promise<unknown> =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[]),
    ),
  };

  return {
    prisma: prisma as unknown as PrismaService,
    userFindMany,
    unitFindMany,
    localityFindMany,
    categoryFindMany,
  };
}

describe('Admin sorting object maps (#52)', () => {
  it('preserves default order and ignores lone sortDirection on AdminUsersRepository.listUsers', async () => {
    const { prisma, userFindMany } = mockPrisma();
    const repo = new AdminUsersRepository(prisma);

    await repo.listUsers({ page: 1, limit: 20 });
    expect(userFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );

    await repo.listUsers({
      page: 1,
      limit: 20,
      sortDirection: SORT_DIRECTION.ASC,
    });
    expect(userFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );

    await repo.listUsers({
      page: 1,
      limit: 20,
      sortBy: ADMIN_USER_SORT_BY.CREATED_AT,
    });
    expect(userFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );

    await repo.listUsers({
      page: 1,
      limit: 20,
      sortBy: ADMIN_USER_SORT_BY.CREATED_AT,
      sortDirection: SORT_DIRECTION.ASC,
    });
    expect(userFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    );

    await repo.listUsers({
      page: 1,
      limit: 20,
      sortBy: ADMIN_USER_SORT_BY.UNIT,
      sortDirection: SORT_DIRECTION.DESC,
    });
    expect(userFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ organizationUnit: { name: 'desc' } }, { id: 'asc' }],
      }),
    );
  });

  it('preserves default order, lone sortDirection, and tie-breakers on listOrganizationUnits', async () => {
    const { prisma, unitFindMany } = mockPrisma();
    const repo = new AdminUsersRepository(prisma);

    await repo.listOrganizationUnits({ page: 1, limit: 20 });
    expect(unitFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      }),
    );

    await repo.listOrganizationUnits({
      page: 1,
      limit: 20,
      sortDirection: SORT_DIRECTION.DESC,
    });
    expect(unitFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      }),
    );

    await repo.listOrganizationUnits({
      page: 1,
      limit: 20,
      sortBy: ORGANIZATION_UNIT_SORT_BY.DESCRIPTION,
      sortDirection: SORT_DIRECTION.DESC,
    });
    expect(unitFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [
          { description: { sort: 'desc', nulls: 'last' } },
          { order: 'asc' },
          { id: 'asc' },
        ],
      }),
    );
  });

  it('shares identical locality sort mapping across admin and public queries', async () => {
    const { prisma, localityFindMany } = mockPrisma();
    const repo = new AdminCatalogsRepository(prisma);

    for (const publicOnly of [false, true]) {
      await repo.listLocalities({ page: 1, limit: 20 }, publicOnly);
      expect(localityFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderBy: [{ provinceName: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        }),
      );

      await repo.listLocalities(
        { page: 1, limit: 20, sortDirection: SORT_DIRECTION.DESC },
        publicOnly,
      );
      expect(localityFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderBy: [{ provinceName: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        }),
      );

      await repo.listLocalities(
        {
          page: 1,
          limit: 20,
          sortBy: LOCALITY_SORT_BY.EFFECTIVE_RANGE,
          sortDirection: SORT_DIRECTION.DESC,
        },
        publicOnly,
      );
      expect(localityFindMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          orderBy: [
            { effectiveFrom: { sort: 'desc', nulls: 'last' } },
            { effectiveTo: { sort: 'desc', nulls: 'last' } },
            { id: 'asc' },
          ],
        }),
      );
    }
  });

  it('preserves default order, lone sortDirection, and tie-breakers on listCategories', async () => {
    const { prisma, categoryFindMany } = mockPrisma();
    const repo = new AdminCatalogsRepository(prisma);

    await repo.listCategories({ page: 1, limit: 100 });
    expect(categoryFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      }),
    );

    await repo.listCategories({
      page: 1,
      limit: 100,
      sortDirection: SORT_DIRECTION.DESC,
    });
    expect(categoryFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      }),
    );

    await repo.listCategories({
      page: 1,
      limit: 100,
      sortBy: ADMIN_CATEGORY_SORT_BY.REFERENCE_COUNT,
      sortDirection: SORT_DIRECTION.DESC,
    });
    expect(categoryFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        orderBy: [
          { products: { _count: 'desc' } },
          { order: 'asc' },
          { id: 'asc' },
        ],
      }),
    );
  });
});
