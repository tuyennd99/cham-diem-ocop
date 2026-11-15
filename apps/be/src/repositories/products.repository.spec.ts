import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsRepository } from './products.repository';

const validFormData = {
  entityName: 'HTX Rạch Gốc',
  representativeName: 'Nguyễn Văn A',
  representativeTitle: 'Giám đốc',
  contactAddress: 'Số 1 Đường Bạch Đằng',
  provinceName: 'Cao Bằng',
  localityName: 'Xã Bạch Đằng',
  phone: '0900000008',
  registrationType: 'FIRST',
  sampleQuantity: 2,
  assessmentYear: 2026,
  declarationAccepted: true,
};

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
      $executeRaw: jest.fn().mockResolvedValue(1),
      locality: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'locality-1',
          code: 'L1',
          name: 'Xã Bạch Đằng',
          provinceName: 'Cao Bằng',
          isActive: true,
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'locality-1',
          code: 'L1',
          name: 'Xã Bạch Đằng',
          provinceName: 'Cao Bằng',
          isActive: true,
        }),
      },
      productCategory: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn(({ where }: { where?: { id?: { in?: string[] } } }) =>
          Promise.resolve(where?.id?.in?.map((id) => ({ id })) ?? []),
        ),
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
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
        findFirst: jest.fn().mockResolvedValue({
          id: 'product',
          categoryId: 'old-category',
          localityId: 'locality-1',
          name: 'Product',
          formData: validFormData,
        }),
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
    await repository.create(
      {
        registrantId: 'registrant',
        categoryId: 'category',
        localityId: 'locality-1',
        name: 'Product',
        formData: validFormData,
      },
      { kind: 'OWNER', id: 'registrant' },
    );
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

  it('filters new-registration choices by active category/criteria set', async () => {
    await repository.listCategories();
    expect(tx.productCategory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          criteriaSet: { is: { isActive: true } },
        },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('returns flat /categories while omitting unready active sets', async () => {
    const incompleteCriteria = [
      { maxScore: 99, subCriteria: [{ options: [{ id: 'option' }] }] },
    ];
    const unready = {
      id: 'category',
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
      criteriaSet: {
        isActive: true,
        criteria: [
          { maxScore: 99, subCriteria: [{ options: [{ id: 'option' }] }] },
        ],
      },
    });
    await expect(
      repository.create(
        {
          registrantId: 'registrant',
          categoryId: 'category',
          name: 'Product',
          formData: {},
        },
        { kind: 'OWNER', id: 'registrant' },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('keeps an inactive category on an existing draft but rejects switching to another unavailable category', async () => {
    tx.productCategory.findUnique.mockResolvedValue(null);
    await expect(
      repository.updateDraft(
        'product',
        { kind: 'OWNER', id: 'registrant' },
        {
          categoryId: 'old-category',
          name: 'Edited',
        },
      ),
    ).resolves.toEqual({ id: 'product' });
    expect(tx.productCategory.count).not.toHaveBeenCalled();
    await expect(
      repository.updateDraft(
        'product',
        { kind: 'OWNER', id: 'registrant' },
        {
          categoryId: 'inactive-category',
        },
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects creating a draft with missing mandatory fields without writing to DB', async () => {
    await expect(
      repository.create(
        {
          registrantId: 'registrant',
          categoryId: 'category',
          name: 'Product',
          formData: {},
        },
        { kind: 'OWNER', id: 'registrant' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.product.create).not.toHaveBeenCalled();
  });

  it('merges partial updates with existing draft data and blocks incomplete legacy drafts until completed', async () => {
    await expect(
      repository.updateDraft(
        'product',
        { kind: 'OWNER', id: 'registrant' },
        {
          formData: {
            contactAddress: 'Số 99 Đường Mới',
          },
        },
      ),
    ).resolves.toEqual({ id: 'product' });
    expect(tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formData: expect.objectContaining({
            entityName: 'HTX Rạch Gốc',
            contactAddress: 'Số 99 Đường Mới',
            phone: '0900000008',
          }),
        }),
      }),
    );

    tx.product.updateMany.mockClear();
    tx.product.findFirst.mockResolvedValue({
      id: 'legacy-draft',
      categoryId: 'old-category',
      localityId: 'locality-1',
      name: 'Legacy draft',
      formData: {
        entityName: 'HTX Cũ',
      },
    });
    await expect(
      repository.updateDraft(
        'legacy-draft',
        { kind: 'OWNER', id: 'registrant' },
        { name: 'Still incomplete' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.product.updateMany).not.toHaveBeenCalled();

    await expect(
      repository.updateDraft(
        'legacy-draft',
        { kind: 'OWNER', id: 'registrant' },
        {
          formData: {
            representativeName: 'Nguyễn Văn B',
            representativeTitle: 'Chủ nhiệm',
            contactAddress: 'Thôn 1',
            provinceName: 'Cao Bằng',
            localityName: 'Xã Bạch Đằng',
            email: 'htx@ocop.test',
            registrationType: 'FIRST',
            sampleQuantity: 1,
            assessmentYear: 2026,
            declarationAccepted: true,
          },
        },
      ),
    ).resolves.toEqual({ id: 'product' });
    expect(tx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          formData: expect.objectContaining({
            entityName: 'HTX Cũ',
            representativeName: 'Nguyễn Văn B',
            email: 'htx@ocop.test',
          }),
        }),
      }),
    );
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
        repository.addAttachment(
          'prod-1',
          { kind: 'OWNER', id: 'user-1' },
          {
            type: 'IMAGE',
            fileName: 'test.png',
            filePath: 'storage-1',
          },
        ),
      ).rejects.toThrow(ConflictException);
      expect(tx.attachment.create).not.toHaveBeenCalled();
    } finally {
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }
  });
});
