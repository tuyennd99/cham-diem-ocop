import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsRepository } from './products.repository';

describe('ProductsRepository history and category availability', () => {
  let tx: any;
  let repository: ProductsRepository;
  let previousDatabaseUrl: string | undefined;
  beforeEach(() => {
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL =
      'postgresql://127.0.0.1/ocop_test?schema=ocop_test_unit';
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      productCategory: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          group: { isActive: true },
          criteriaSet: {
            isActive: true,
            criteria: [
              { maxScore: 100, subCriteria: [{ options: [{ id: 'option' }] }] },
            ],
          },
        }),
      },
      product: {
        create: jest.fn().mockResolvedValue({
          id: 'product',
          createdAt: new Date('2026-10-22T00:00:00Z'),
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'product', categoryId: 'old-category' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'product' }),
      },
      productStatusEvent: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: null } }),
        create: jest.fn(),
      },
    };
    repository = new ProductsRepository({
      ...tx,
      $transaction: (run: (db: any) => unknown) => run(tx),
    } as unknown as PrismaService);
  });
  afterEach(() => {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  it('creates the DRAFT event and creator atomically with the product', async () => {
    await repository.create({
      registrantId: 'registrant',
      categoryId: 'category',
      name: 'Product',
      formData: {},
    });
    expect(tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdById: 'registrant' }),
      }),
    );
    expect(tx.productStatusEvent.create).toHaveBeenCalledWith({
      data: {
        productId: 'product',
        fromStatus: null,
        toStatus: 'DRAFT',
        sequence: 1,
        actorId: 'registrant',
        createdAt: new Date('2026-10-22T00:00:00Z'),
      },
    });
  });

  it('filters new-registration choices by active group/category/criteria set', async () => {
    await repository.listCategories();
    expect(tx.productCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          group: { isActive: true },
          criteriaSet: { is: { isActive: true } },
        },
      }),
    );
  });

  it('keeps the /categories response shape while omitting unready active sets', async () => {
    const incompleteCriteria = [
      { maxScore: 99, subCriteria: [{ options: [{ id: 'option' }] }] },
    ];
    const unready = {
      id: 'category',
      groupCode: 'GROUP',
      groupName: 'Group',
      classificationGroup: 'Classification',
      classificationSubgroup: null,
      name: 'Category',
      description: null,
      criteriaSet: {
        isActive: true,
        name: 'Official set',
        source: 'Official source',
        criteria: incompleteCriteria,
      },
    };
    const readyCriteria = [
      { maxScore: 100, subCriteria: [{ options: [{ id: 'option' }] }] },
    ];
    tx.productCategory.findMany
      .mockResolvedValueOnce([unready])
      .mockResolvedValueOnce([
        {
          ...unready,
          criteriaSet: { ...unready.criteriaSet, criteria: readyCriteria },
        },
      ]);

    await expect(repository.listCategories()).resolves.toEqual([]);
    const choices = await repository.listCategories();
    expect(choices).toHaveLength(1);
    expect(choices[0]).toEqual({
      id: 'category',
      groupCode: 'GROUP',
      groupName: 'Group',
      classificationGroup: 'Classification',
      classificationSubgroup: null,
      name: 'Category',
      description: null,
      criteriaSet: {
        name: 'Official set',
        source: 'Official source',
        criteria: readyCriteria,
      },
    });
  });

  it('rejects a category whose active criteria set is incomplete or does not total 100', async () => {
    tx.productCategory.findUnique = jest.fn().mockResolvedValue({
      isActive: true,
      group: { isActive: true },
      criteriaSet: {
        isActive: true,
        criteria: [
          { maxScore: 99, subCriteria: [{ options: [{ id: 'option' }] }] },
        ],
      },
    });
    await expect(
      repository.create({
        registrantId: 'registrant',
        categoryId: 'category',
        name: 'Product',
        formData: {},
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('keeps an inactive category on an existing draft but rejects switching to another unavailable category', async () => {
    tx.productCategory.findUnique.mockResolvedValue(null);
    await expect(
      repository.updateDraft('product', 'registrant', {
        categoryId: 'old-category',
        name: 'Edited',
      }),
    ).resolves.toEqual({ id: 'product' });
    expect(tx.productCategory.count).not.toHaveBeenCalled();
    await expect(
      repository.updateDraft('product', 'registrant', {
        categoryId: 'inactive-category',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('ProductsRepository.addAttachment', () => {
  it('rejects upload when maximum attachment count is reached', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prod-1' }),
      },
      attachment: {
        count: jest.fn().mockResolvedValue(20),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const repository = new ProductsRepository(
      prisma as unknown as PrismaService,
    );

    const prevDb = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://127.0.0.1/ocop_test?schema=public';
    try {
      await expect(
        repository.addAttachment('prod-1', 'user-1', {
          type: 'IMAGE',
          fileName: 'test.png',
          filePath: 'storage-1',
        }),
      ).rejects.toThrow(ConflictException);
      expect(tx.attachment.create).not.toHaveBeenCalled();
    } finally {
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }
  });
});
