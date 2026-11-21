import {
  AttachmentType,
  ProductPublicationState,
  ProductStatus,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicProductQueryDto } from '../dtos/products.dto';
import {
  isSeoEligibleProduct,
  ProductsRepository,
  SEO_ELIGIBLE_PRODUCT_STATUSES,
} from './products.repository';
import { ProductsService } from '../services/products.service';
import { ProductsController } from '../controllers/products.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('Public product SEO eligibility and query filtering', () => {
  it('evaluates isSeoEligibleProduct strictly as approvedAt !== null AND status in APPROVED/SCORING/COMPLETED', () => {
    expect(SEO_ELIGIBLE_PRODUCT_STATUSES).toEqual([
      ProductStatus.APPROVED,
      ProductStatus.SCORING,
      ProductStatus.COMPLETED,
    ]);

    const approvedTimestamp = '2026-10-01T00:00:00.000Z';

    // Eligible statuses with approvedAt present
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.APPROVED,
        approvedAt: approvedTimestamp,
      }),
    ).toBe(true);
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.SCORING,
        approvedAt: approvedTimestamp,
      }),
    ).toBe(true);
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.COMPLETED,
        approvedAt: new Date(approvedTimestamp),
      }),
    ).toBe(true);

    // Eligible statuses but missing approvedAt (legacy / unapproved scoring)
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.SCORING,
        approvedAt: null,
      }),
    ).toBe(false);
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.COMPLETED,
        approvedAt: undefined,
      }),
    ).toBe(false);
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.APPROVED,
        approvedAt: '',
      }),
    ).toBe(false);

    // Non-eligible statuses even if approvedAt is set
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.DRAFT,
        approvedAt: approvedTimestamp,
      }),
    ).toBe(false);
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.SUBMITTED,
        approvedAt: approvedTimestamp,
      }),
    ).toBe(false);
    expect(
      isSeoEligibleProduct({
        status: ProductStatus.RETURNED,
        approvedAt: approvedTimestamp,
      }),
    ).toBe(false);
    expect(isSeoEligibleProduct(null)).toBe(false);
    expect(isSeoEligibleProduct(undefined)).toBe(false);
  });

  it('validates and transforms approvedOnly in PublicProductQueryDto', async () => {
    const dtoTrue = plainToInstance(PublicProductQueryDto, {
      page: '1',
      limit: '6',
      approvedOnly: 'true',
    });
    const errorsTrue = await validate(dtoTrue);
    expect(errorsTrue).toHaveLength(0);
    expect(dtoTrue.approvedOnly).toBe(true);

    const dtoFalse = plainToInstance(PublicProductQueryDto, {
      approvedOnly: 'false',
    });
    const errorsFalse = await validate(dtoFalse);
    expect(errorsFalse).toHaveLength(0);
    expect(dtoFalse.approvedOnly).toBe(false);

    const dtoOmitted = plainToInstance(PublicProductQueryDto, {});
    const errorsOmitted = await validate(dtoOmitted);
    expect(errorsOmitted).toHaveLength(0);
    expect(dtoOmitted.approvedOnly).toBeUndefined();
  });

  it('preserves existing public list contract when approvedOnly is omitted and selects approvedAt', async () => {
    const findMany = jest.fn(
      (_arg?: { where?: unknown; select?: Record<string, unknown> }) =>
        Promise.resolve([
          {
            id: 'prod-submitted',
            name: 'Hồ sơ mới nộp',
            description: null,
            status: ProductStatus.SUBMITTED,
            approvedAt: null,
            publicationState: ProductPublicationState.UNPUBLISHED,
            publishedAt: null,
            finalScore: 88,
            starRating: 4,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            category: { id: 'cat-1', name: 'Thực phẩm' },
            attachments: [],
          },
        ]),
    );
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      product: { findMany, count },
    } as unknown as PrismaService;

    const repo = new ProductsRepository(prisma);
    const service = new ProductsService(repo);
    const controller = new ProductsController(service);

    const result = await controller.list({
      page: 1,
      limit: 6,
    });

    const queryArg = findMany.mock.calls[0]?.[0] as {
      where?: unknown;
      select?: Record<string, unknown>;
    };
    expect(queryArg?.where).toEqual({
      status: {
        in: [
          ProductStatus.SUBMITTED,
          ProductStatus.APPROVED,
          ProductStatus.SCORING,
          ProductStatus.COMPLETED,
        ],
      },
    });
    expect(queryArg?.select).toMatchObject({ approvedAt: true });
    expect(result.data[0].approvedAt).toBeNull();
    // Unpublished score/stars must still be stripped
    expect(result.data[0].finalScore).toBeNull();
    expect(result.data[0].starRating).toBeNull();
  });

  it('filters by approvedAt !== null and status IN (APPROVED, SCORING, COMPLETED) when approvedOnly is true', async () => {
    const approvedDate = new Date('2026-10-02T08:00:00.000Z');
    const findMany = jest.fn(
      (_arg?: { where?: unknown; select?: Record<string, unknown> }) =>
        Promise.resolve([
          {
            id: 'prod-approved-unpublished',
            name: 'Chè Shan Tuyết',
            description: 'Đặc sản vùng cao',
            status: ProductStatus.SCORING,
            approvedAt: approvedDate,
            publicationState: ProductPublicationState.UNPUBLISHED,
            publishedAt: null,
            finalScore: 91.5,
            starRating: 5,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            category: { id: 'cat-1', name: 'Đồ uống' },
            attachments: [],
          },
          {
            id: 'prod-completed-published',
            name: 'Mật ong bạc hà',
            description: 'Mật ong nguyên chất',
            status: ProductStatus.COMPLETED,
            approvedAt: approvedDate,
            publicationState: ProductPublicationState.PUBLISHED,
            publishedAt: approvedDate,
            finalScore: 92,
            starRating: 5,
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            category: { id: 'cat-1', name: 'Thực phẩm' },
            attachments: [],
          },
        ]),
    );
    const count = jest.fn().mockResolvedValue(2);
    const prisma = {
      product: { findMany, count },
    } as unknown as PrismaService;

    const repo = new ProductsRepository(prisma);
    const service = new ProductsService(repo);
    const controller = new ProductsController(service);

    const result = await controller.list({
      page: 1,
      limit: 6,
      categoryId: 'cat-1',
      approvedOnly: true,
    });

    const queryArg = findMany.mock.calls[0]?.[0] as {
      where?: unknown;
      select?: Record<string, unknown>;
    };
    expect(queryArg?.where).toEqual({
      approvedAt: { not: null },
      status: {
        in: [
          ProductStatus.APPROVED,
          ProductStatus.SCORING,
          ProductStatus.COMPLETED,
        ],
      },
      categoryId: 'cat-1',
    });
    expect(queryArg?.select).toMatchObject({ approvedAt: true });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].approvedAt).toEqual(approvedDate);
    expect(result.data[0].finalScore).toBeNull();
    expect(result.data[0].starRating).toBeNull();
    expect(result.data[1].finalScore).toBe(92);
    expect(result.data[1].starRating).toBe(5);
  });

  it('includes approvedAt in findPublicById while keeping SUBMITTED accessible', async () => {
    const findFirst = jest.fn((_arg?: { select?: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'prod-submitted',
        name: 'Sản phẩm đã nộp chờ duyệt',
        description: 'Mô tả',
        status: ProductStatus.SUBMITTED,
        approvedAt: null,
        publicationState: ProductPublicationState.UNPUBLISHED,
        publishedAt: null,
        finalScore: 75,
        starRating: 4,
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        category: { id: 'cat-1', name: 'Thực phẩm' },
        attachments: [],
      }),
    );
    const prisma = {
      product: { findFirst },
    } as unknown as PrismaService;

    const repo = new ProductsRepository(prisma);
    const product = await repo.findPublicById('prod-submitted');

    const queryArg = findFirst.mock.calls[0]?.[0] as {
      select?: Record<string, unknown>;
    };
    expect(queryArg?.select).toMatchObject({ approvedAt: true });
    expect(product).toEqual(
      expect.objectContaining({
        id: 'prod-submitted',
        status: ProductStatus.SUBMITTED,
        approvedAt: null,
        finalScore: null,
        starRating: null,
      }),
    );
  });

  it('splits public images and videos in findPublicById and restricts getPublicAttachment to public images/videos only', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'prod-with-video',
      codeNumber: 23,
      name: 'Hạt dẻ Trùng Khánh',
      description: 'Có video giới thiệu.',
      status: ProductStatus.SCORING,
      approvedAt: new Date('2026-10-01T00:00:00.000Z'),
      publicationState: ProductPublicationState.UNPUBLISHED,
      publishedAt: null,
      finalScore: null,
      starRating: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      category: { id: 'cat-1', name: 'Rau, củ, quả, hạt tươi' },
      attachments: [
        { id: 'att-img', fileName: 'anh-1.jpg' },
        { id: 'att-vid', fileName: 'gioi-thieu.mp4' },
      ],
    });
    const findAttachment = jest.fn();
    const prisma = {
      product: { findFirst },
      attachment: { findFirst: findAttachment },
    } as unknown as PrismaService;

    const repo = new ProductsRepository(prisma);
    const detail = await repo.findPublicById('prod-with-video');
    expect(detail?.attachments).toEqual([
      { id: 'att-img', fileName: 'anh-1.jpg' },
    ]);
    expect(detail?.videos).toEqual([
      { id: 'att-vid', fileName: 'gioi-thieu.mp4' },
    ]);

    const service = new ProductsService(repo);
    jest
      .spyOn(
        service as unknown as {
          asFile: (
            key: string,
            name: string,
            range?: string,
          ) => Promise<unknown>;
        },
        'asFile',
      )
      .mockResolvedValue({ ok: true });

    findAttachment.mockResolvedValueOnce({
      id: 'att-pdf',
      type: AttachmentType.EVIDENCE,
      fileName: 'ho-so.pdf',
      filePath: 'storage-key-pdf',
      product: { status: ProductStatus.SCORING },
    });
    await expect(
      service.getPublicAttachment('prod-with-video', 'att-pdf'),
    ).rejects.toThrow('Attachment not found');

    findAttachment.mockResolvedValueOnce({
      id: 'att-vid',
      type: AttachmentType.EVIDENCE,
      fileName: 'gioi-thieu.mp4',
      filePath: 'storage-key-vid',
      product: { status: ProductStatus.SCORING },
    });
    await expect(
      service.getPublicAttachment('prod-with-video', 'att-vid', 'bytes=0-10'),
    ).resolves.toEqual({ ok: true });
  });
});
