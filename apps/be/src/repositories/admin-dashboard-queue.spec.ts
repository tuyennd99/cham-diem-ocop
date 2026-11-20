import { PrismaService } from '../prisma/prisma.service';
import { AdminRepository } from './admin.repository';

it('pages the whole dashboard queue and filters before paging', async () => {
  const products = Array.from({ length: 12 }, (_, index) => ({
    id: `product-${index + 1}`,
    name: `Hồ sơ ${index + 1}`,
    category: { name: 'Thực phẩm' },
  }));
  type MockWhere = { OR?: Array<{ name?: { contains?: string } }> };
  const matching = (where?: MockWhere) => {
    const term = where?.OR?.[0]?.name?.contains?.toLowerCase() ?? '';
    return products.filter((item) => item.name.toLowerCase().includes(term));
  };
  const prisma = {
    product: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn(
        (args: { where?: MockWhere; skip?: number; take?: number }) => {
          const skip = args.skip ?? 0;
          const end = args.take === undefined ? undefined : skip + args.take;
          return Promise.resolve(matching(args.where).slice(skip, end));
        },
      ),
      count: jest.fn(({ where }: { where?: MockWhere }) =>
        Promise.resolve(matching(where).length),
      ),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const repository = new AdminRepository(prisma as unknown as PrismaService);
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://127.0.0.1/ocop_test?schema=public';
  try {
    const lastPage = await repository.dashboardData(true, 3);
    expect(lastPage.nextProducts.map((item) => item.id)).toEqual([
      'product-11',
      'product-12',
    ]);
    expect(lastPage.nextProductsCount).toBe(12);

    const searched = await repository.dashboardData(true, 1, 'hồ sơ 12');
    expect(searched.nextProducts.map((item) => item.id)).toEqual([
      'product-12',
    ]);
    expect(searched.nextProductsCount).toBe(1);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});
