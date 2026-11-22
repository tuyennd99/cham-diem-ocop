import { Module, NotFoundException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ProductPublicationState, ProductStatus } from '@prisma/client';
import { SORT_DIRECTION } from '../constants/products';
import type {
  CreateLocalityDto,
  PublicLocalitiesQueryDto,
} from '../dtos/admin-catalogs.dto';
import { RedisModule } from '../modules/redis.module';
import { AdminCatalogsRepository } from '../repositories/admin-catalogs.repository';
import { AdminRepository } from '../repositories/admin.repository';
import { EvaluationsRepository } from '../repositories/evaluations.repository';
import { ProductsRepository } from '../repositories/products.repository';
import type { AccessTokenPayload, AuthenticatedPrincipal } from '../types/auth';
import { AdminCatalogsService } from './admin-catalogs.service';
import { AdminService } from './admin.service';
import { EvaluationsService } from './evaluations.service';
import { ProductsService } from './products.service';
import { RedisService } from './redis.service';

function createMockRedis(enabled = true) {
  const isEnabled = jest.fn(() => enabled);
  const getJson = jest.fn<Promise<unknown>, [string]>().mockResolvedValue(null);
  const setJson = jest
    .fn<Promise<boolean>, [string, unknown, number]>()
    .mockResolvedValue(true);
  const del = jest.fn<Promise<void>, string[]>().mockResolvedValue(undefined);
  const invalidatePrefix = jest
    .fn<Promise<void>, [string]>()
    .mockResolvedValue(undefined);

  return {
    redis: {
      isEnabled,
      getJson,
      setJson,
      del,
      invalidatePrefix,
    } as unknown as RedisService,
    mocks: { isEnabled, getJson, setJson, del, invalidatePrefix },
  };
}

describe('Public Redis caching & mutation invalidation (#63)', () => {
  const adminPrincipal: AuthenticatedPrincipal = {
    sub: 'admin-1',
    email: 'admin@example.com',
    role: 'ADMIN',
    roles: ['ADMIN'],
    staffPermissions: ['VIEW', 'MANAGE'],
    organizationUnitId: null,
    organizationUnit: null,
    tokenVersion: 0,
  };

  const ownerPrincipal: AccessTokenPayload = {
    sub: 'user-1',
    email: 'owner@example.com',
    role: 'REGISTRANT',
    roles: ['REGISTRANT'],
    tokenVersion: 0,
  };

  const requestMeta = {
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    requestId: 'req-1',
  };

  describe('ProductsService public reads', () => {
    it('caches categories with TTL 60s on miss and returns cached data on hit', async () => {
      const dbCategories = [{ id: 'cat-1', name: 'Thực phẩm' }];
      const listCategories = jest.fn().mockResolvedValue(dbCategories);
      const repository = { listCategories } as unknown as ProductsRepository;
      const { redis, mocks } = createMockRedis(true);
      const service = new ProductsService(repository, redis);

      // Miss -> DB + setJson(TTL 60)
      await expect(service.categories()).resolves.toEqual(dbCategories);
      expect(mocks.getJson).toHaveBeenCalledWith('ocop:cache:v1:categories');
      expect(listCategories).toHaveBeenCalledTimes(1);
      expect(mocks.setJson).toHaveBeenCalledWith(
        'ocop:cache:v1:categories',
        dbCategories,
        60,
      );

      // Hit -> no DB call
      const cachedCategories = [{ id: 'cat-cached', name: 'Đồ uống' }];
      mocks.getJson.mockResolvedValueOnce(cachedCategories);
      await expect(service.categories()).resolves.toEqual(cachedCategories);
      expect(listCategories).toHaveBeenCalledTimes(1);
    });

    it('caches listPublic with deterministic keys for equivalent queries and TTL 60s', async () => {
      const dbPage = {
        data: [{ id: 'prod-1', name: 'Chè Shan Tuyết' }],
        total: 1,
      };
      const listPublic = jest.fn().mockResolvedValue(dbPage);
      const repository = { listPublic } as unknown as ProductsRepository;
      const { redis, mocks } = createMockRedis(true);
      const service = new ProductsService(repository, redis);

      const first = await service.listPublic({
        page: 1,
        limit: 20,
        q: 'chè',
      });
      expect(first).toEqual({
        data: dbPage.data,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      expect(mocks.setJson).toHaveBeenCalledTimes(1);
      const [key1, val1, ttl1] = mocks.setJson.mock.calls[0];
      expect(key1.startsWith('ocop:cache:v1:public-products:')).toBe(true);
      expect(val1).toEqual(first);
      expect(ttl1).toBe(60);

      // Equivalent query using `query` instead of `q` and explicit `approvedOnly: false`
      mocks.getJson.mockResolvedValueOnce(first);
      const second = await service.listPublic({
        approvedOnly: false,
        query: 'chè',
        limit: 20,
        page: 1,
        categoryId: '',
      });
      expect(second).toEqual(first);
      expect(mocks.getJson).toHaveBeenNthCalledWith(2, key1);
      expect(listPublic).toHaveBeenCalledTimes(1);

      // Positional form shares the same deterministic key
      mocks.getJson.mockResolvedValueOnce(first);
      await service.listPublic(1, 20, undefined, 'chè', false);
      expect(mocks.getJson).toHaveBeenNthCalledWith(3, key1);
      expect(listPublic).toHaveBeenCalledTimes(1);
    });

    it('caches getPublic(id) on miss with TTL 60s, serves from cache on hit, and does not cache 404', async () => {
      const dbProduct = {
        id: 'prod-1',
        name: 'Mật ong',
        publicationState: ProductPublicationState.PUBLISHED,
        finalScore: 92,
        starRating: 5,
      };
      const findPublicById = jest.fn().mockResolvedValue(dbProduct);
      const repository = { findPublicById } as unknown as ProductsRepository;
      const { redis, mocks } = createMockRedis(true);
      const service = new ProductsService(repository, redis);

      await expect(service.getPublic('prod-1')).resolves.toEqual(dbProduct);
      expect(mocks.setJson).toHaveBeenCalledWith(
        'ocop:cache:v1:public-products:detail:prod-1',
        dbProduct,
        60,
      );

      mocks.getJson.mockResolvedValueOnce(dbProduct);
      await expect(service.getPublic('prod-1')).resolves.toEqual(dbProduct);
      expect(findPublicById).toHaveBeenCalledTimes(1);

      // Missing product throws NotFoundException and does not write to Redis
      findPublicById.mockResolvedValueOnce(null);
      await expect(service.getPublic('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(mocks.setJson).toHaveBeenCalledTimes(1);
    });

    it('falls back transparently to PostgreSQL when Redis is disabled or throws errors', async () => {
      const dbCategories = [{ id: 'cat-1', name: 'Thực phẩm' }];
      const dbList = { data: [{ id: 'prod-1' }], total: 1 };
      const dbDetail = { id: 'prod-1', name: 'Sản phẩm' };
      const repository = {
        listCategories: jest.fn().mockResolvedValue(dbCategories),
        listPublic: jest.fn().mockResolvedValue(dbList),
        findPublicById: jest.fn().mockResolvedValue(dbDetail),
      } as unknown as ProductsRepository;

      // Disabled Redis (REDIS_URL unset)
      const disabled = createMockRedis(false);
      const disabledService = new ProductsService(repository, disabled.redis);
      await expect(disabledService.categories()).resolves.toEqual(dbCategories);
      await expect(
        disabledService.listPublic({ page: 1, limit: 10 }),
      ).resolves.toMatchObject({ data: dbList.data });
      await expect(disabledService.getPublic('prod-1')).resolves.toEqual(
        dbDetail,
      );
      expect(disabled.mocks.getJson).not.toHaveBeenCalled();
      expect(disabled.mocks.setJson).not.toHaveBeenCalled();

      // Redis enabled but throwing errors on get/set
      const broken = createMockRedis(true);
      broken.mocks.getJson.mockRejectedValue(new Error('ECONNREFUSED'));
      broken.mocks.setJson.mockRejectedValue(new Error('ECONNREFUSED'));
      const fallbackService = new ProductsService(repository, broken.redis);
      await expect(fallbackService.categories()).resolves.toEqual(dbCategories);
      await expect(
        fallbackService.listPublic({ page: 1, limit: 10 }),
      ).resolves.toMatchObject({ data: dbList.data });
      await expect(fallbackService.getPublic('prod-1')).resolves.toEqual(
        dbDetail,
      );
    });
  });

  describe('AdminCatalogsService public localities caching & catalog invalidation', () => {
    it('caches listPublicLocalities with deterministic keys (TTL 60s) and falls back on Redis error', async () => {
      const dbLocalities = {
        data: [{ id: 'loc-1', name: 'Xã Tân Cương' }],
        total: 1,
      };
      const listLocalities = jest.fn().mockResolvedValue(dbLocalities);
      const repository = {
        listLocalities,
      } as unknown as AdminCatalogsRepository;
      const { redis, mocks } = createMockRedis(true);
      const service = new AdminCatalogsService(repository, redis);

      const query1: PublicLocalitiesQueryDto = {
        page: 1,
        limit: 20,
        provinceName: 'Thái Nguyên',
      };
      const first = await service.listPublicLocalities(query1);
      expect(first).toEqual({
        data: dbLocalities.data,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      expect(mocks.setJson).toHaveBeenCalledTimes(1);
      const [key1, , ttl1] = mocks.setJson.mock.calls[0];
      expect(key1.startsWith('ocop:cache:v1:localities:')).toBe(true);
      expect(ttl1).toBe(60);

      // Equivalent query with different property order and empty q
      mocks.getJson.mockResolvedValueOnce(first);
      const query2: PublicLocalitiesQueryDto = {
        provinceName: 'Thái Nguyên',
        q: '',
        limit: 20,
        page: 1,
      };
      await expect(service.listPublicLocalities(query2)).resolves.toEqual(
        first,
      );
      expect(mocks.getJson).toHaveBeenNthCalledWith(2, key1);
      expect(listLocalities).toHaveBeenCalledTimes(1);

      // Explicit sortDirection ASC matches defaulted sortDirection when sortBy is set
      const querySortDefault: PublicLocalitiesQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'name',
      };
      const querySortExplicit: PublicLocalitiesQueryDto = {
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortDirection: SORT_DIRECTION.ASC,
      };
      await service.listPublicLocalities(querySortDefault);
      const sortKey = mocks.setJson.mock.calls[1]?.[0];
      mocks.getJson.mockResolvedValueOnce(first);
      await service.listPublicLocalities(querySortExplicit);
      expect(mocks.getJson).toHaveBeenLastCalledWith(sortKey);

      expect(listLocalities).toHaveBeenCalledWith(query1, true);

      // Redis error fallback to PostgreSQL
      mocks.getJson.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      mocks.setJson.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(service.listPublicLocalities(query1)).resolves.toEqual({
        data: dbLocalities.data,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('invalidates categories and public-products on category mutations', async () => {
      const repository = {
        createCategory: jest.fn().mockResolvedValue({ id: 'cat-new' }),
        updateCategory: jest.fn().mockResolvedValue({ id: 'cat-1' }),
        listCategories: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      } as unknown as AdminCatalogsRepository;
      const { redis, mocks } = createMockRedis(true);
      const service = new AdminCatalogsService(repository, redis);

      await service.createCategory(
        { name: 'Mới', reason: 'Add' },
        adminPrincipal.sub,
        requestMeta,
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:categories',
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:public-products:',
      );

      mocks.invalidatePrefix.mockClear();
      await service.updateCategory(
        'cat-1',
        { name: 'Sửa', reason: 'Fix' },
        adminPrincipal.sub,
        requestMeta,
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:categories',
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:public-products:',
      );

      // Read-only admin listCategories should not invalidate or hit public cache
      mocks.invalidatePrefix.mockClear();
      await service.listCategories({
        page: 1,
        limit: 20,
      });
      expect(mocks.invalidatePrefix).not.toHaveBeenCalled();
    });

    it('invalidates localities and public-products on locality mutations', async () => {
      const repository = {
        createLocality: jest.fn().mockResolvedValue({ id: 'loc-new' }),
        updateLocality: jest.fn().mockResolvedValue({ id: 'loc-1' }),
      } as unknown as AdminCatalogsRepository;
      const { redis, mocks } = createMockRedis(true);
      const service = new AdminCatalogsService(repository, redis);

      await service.createLocality(
        {
          name: 'Xã A',
          provinceName: 'Tỉnh B',
          reason: 'Add',
        } as CreateLocalityDto,
        adminPrincipal.sub,
        requestMeta,
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:localities',
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:public-products:',
      );

      mocks.invalidatePrefix.mockClear();
      await service.updateLocality(
        'loc-1',
        { name: 'Xã A2', reason: 'Edit' },
        adminPrincipal.sub,
        requestMeta,
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:localities',
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:public-products:',
      );
    });
  });

  describe('Cache invalidation on product, scoring, publication, reopen, and evaluation mutations', () => {
    it('invalidates public-products on publish, reopen, approve, return, assignments, and evaluation reopen in AdminService', async () => {
      const addProductJudgeAssignment = jest
        .fn()
        .mockResolvedValue({ id: 'prod-1' });
      const repository = {
        approveProduct: jest
          .fn()
          .mockResolvedValue({ id: 'prod-1', status: ProductStatus.APPROVED }),
        returnProduct: jest
          .fn()
          .mockResolvedValue({ id: 'prod-1', status: ProductStatus.RETURNED }),
        publishProductResults: jest.fn().mockResolvedValue({
          id: 'prod-1',
          publicationState: ProductPublicationState.PUBLISHED,
        }),
        reopenProduct: jest.fn().mockResolvedValue({
          id: 'prod-1',
          status: ProductStatus.SCORING,
          publicationState: ProductPublicationState.UPDATING,
        }),
        addProductJudgeAssignment,
        removeProductJudgeAssignment: jest
          .fn()
          .mockResolvedValue({ id: 'prod-1' }),
        reopenEvaluation: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        replaceAssignments: jest.fn().mockResolvedValue([]),
      } as unknown as AdminRepository;
      const { redis, mocks } = createMockRedis(true);
      const service = new AdminService(repository, redis);

      await service.approveProduct(
        'prod-1',
        { reason: 'ok' },
        adminPrincipal,
        requestMeta,
      );
      await service.returnProduct(
        'prod-1',
        { reason: 'thiếu hồ sơ' },
        adminPrincipal,
        requestMeta,
      );
      await service.publishProductResults(
        'prod-1',
        { reason: 'công bố' },
        adminPrincipal,
        requestMeta,
      );
      await service.reopenProduct(
        'prod-1',
        { reason: 'mở lại' },
        adminPrincipal,
        requestMeta,
      );
      await service.addProductJudgeAssignment(
        'prod-1',
        { judgeId: 'judge-1', reason: 'bổ sung' },
        adminPrincipal,
        requestMeta,
      );
      await service.removeProductJudgeAssignment(
        'prod-1',
        'judge-1',
        { reason: 'gỡ' },
        adminPrincipal,
        requestMeta,
      );
      await service.reopenEvaluation(
        'prod-1',
        'eval-1',
        { reason: 'chấm lại' },
        adminPrincipal,
        requestMeta,
      );
      await service.replaceAssignments(
        { assignments: [], reason: 'sync' },
        adminPrincipal.sub,
        requestMeta,
      );

      expect(mocks.invalidatePrefix).toHaveBeenCalledTimes(8);
      for (const [prefix] of mocks.invalidatePrefix.mock.calls) {
        expect(prefix).toBe('ocop:cache:v1:public-products:');
      }

      // Confirmation prompt (no DB mutation yet) should not invalidate unnecessarily
      mocks.invalidatePrefix.mockClear();
      addProductJudgeAssignment.mockResolvedValueOnce({
        requiresRestoreConfirmation: true,
        previousEvaluation: { id: 'eval-1' },
      });
      await service.addProductJudgeAssignment(
        'prod-1',
        { judgeId: 'judge-1', reason: 'bổ sung' },
        adminPrincipal,
        requestMeta,
      );
      expect(mocks.invalidatePrefix).not.toHaveBeenCalled();
    });

    it('invalidates public-products on EvaluationsService.saveDraft and submit', async () => {
      const repository = {
        saveDraft: jest.fn().mockResolvedValue({ id: 'eval-1' }),
        submit: jest.fn().mockResolvedValue({ id: 'eval-1' }),
      } as unknown as EvaluationsRepository;
      const { redis, mocks } = createMockRedis(true);
      const service = new EvaluationsService(repository, redis);

      await service.saveDraft('judge-1', 'prod-1', {
        scores: [],
      });
      await service.submit('judge-1', 'prod-1', 'v1');

      expect(mocks.invalidatePrefix).toHaveBeenCalledTimes(2);
      expect(mocks.invalidatePrefix).toHaveBeenNthCalledWith(
        1,
        'ocop:cache:v1:public-products:',
      );
      expect(mocks.invalidatePrefix).toHaveBeenNthCalledWith(
        2,
        'ocop:cache:v1:public-products:',
      );
    });

    it('invalidates public-products (and localities on submit/create/update) in ProductsService mutations without failing if Redis throws', async () => {
      const repository = {
        create: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        updateDraft: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        deleteDraft: jest.fn().mockResolvedValue([]),
        submitDraft: jest
          .fn()
          .mockResolvedValue({ id: 'prod-1', status: ProductStatus.SUBMITTED }),
        removeAttachment: jest.fn().mockResolvedValue('missing-key'),
      } as unknown as ProductsRepository;
      const { redis, mocks } = createMockRedis(true);
      mocks.invalidatePrefix.mockRejectedValue(new Error('Redis timeout'));
      const service = new ProductsService(repository, redis);

      await service.create(
        {
          categoryId: 'cat-1',
          name: 'SP A',
          formData: {},
        },
        ownerPrincipal,
      );
      await service.update('prod-1', { name: 'SP A2' }, ownerPrincipal);
      await service.submit('prod-1', ownerPrincipal);
      await service.remove('prod-1', ownerPrincipal);
      await service.removeAttachment('prod-1', 'att-1', ownerPrincipal);

      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:public-products:',
      );
      expect(mocks.invalidatePrefix).toHaveBeenCalledWith(
        'ocop:cache:v1:localities',
      );
    });

    it('never serves stale scores or stars after publishProductResults or reopenProduct', async () => {
      const store = new Map<string, string>();
      const inMemoryRedis = {
        isEnabled: jest.fn(() => true),
        getJson: jest.fn((key: string) => {
          const raw = store.get(key);
          return Promise.resolve(
            raw === undefined ? null : (JSON.parse(raw) as unknown),
          );
        }),
        setJson: jest.fn((key: string, value: unknown) => {
          store.set(key, JSON.stringify(value));
          return Promise.resolve(true);
        }),
        del: jest.fn((...keys: string[]) => {
          for (const key of keys) store.delete(key);
          return Promise.resolve();
        }),
        invalidatePrefix: jest.fn((prefix: string) => {
          for (const key of [...store.keys()]) {
            if (key.startsWith(prefix)) store.delete(key);
          }
          return Promise.resolve();
        }),
      } as unknown as RedisService;

      let dbState: {
        id: string;
        name: string;
        status: ProductStatus;
        publicationState: ProductPublicationState;
        finalScore: number | null;
        starRating: number | null;
      } = {
        id: 'prod-1',
        name: 'Chè Thái Nguyên',
        status: ProductStatus.COMPLETED,
        publicationState: ProductPublicationState.UNPUBLISHED,
        finalScore: null,
        starRating: null,
      };

      const productsRepo = {
        listPublic: jest.fn(() =>
          Promise.resolve({ data: [{ ...dbState }], total: 1 }),
        ),
        findPublicById: jest.fn(() => Promise.resolve({ ...dbState })),
      } as unknown as ProductsRepository;

      const adminRepo = {
        publishProductResults: jest.fn(() => {
          dbState = {
            ...dbState,
            publicationState: ProductPublicationState.PUBLISHED,
            finalScore: 91.5,
            starRating: 5,
          };
          return Promise.resolve({ ...dbState });
        }),
        reopenProduct: jest.fn(() => {
          dbState = {
            ...dbState,
            status: ProductStatus.SCORING,
            publicationState: ProductPublicationState.UPDATING,
            finalScore: null,
            starRating: null,
          };
          return Promise.resolve({ ...dbState });
        }),
      } as unknown as AdminRepository;

      const productsService = new ProductsService(productsRepo, inMemoryRedis);
      const adminService = new AdminService(adminRepo, inMemoryRedis);

      // 1. Prime cache before publication (scores hidden)
      const beforePublishList = await productsService.listPublic({
        page: 1,
        limit: 20,
      });
      const beforePublishDetail = await productsService.getPublic('prod-1');
      expect(beforePublishList.data[0].finalScore).toBeNull();
      expect(beforePublishDetail.starRating).toBeNull();
      expect(store.size).toBe(2);

      // 2. Publish results -> cache invalidated immediately -> public reads see 91.5 / 5 stars
      await adminService.publishProductResults(
        'prod-1',
        { reason: 'Công bố' },
        adminPrincipal,
        requestMeta,
      );
      expect(store.size).toBe(0);
      const afterPublishList = await productsService.listPublic({
        page: 1,
        limit: 20,
      });
      const afterPublishDetail = await productsService.getPublic('prod-1');
      expect(afterPublishList.data[0].finalScore).toBe(91.5);
      expect(afterPublishDetail.starRating).toBe(5);
      expect(store.size).toBe(2);

      // 3. Reopen product -> cache invalidated immediately -> public reads reflect SCORING & cleared scores
      await adminService.reopenProduct(
        'prod-1',
        { reason: 'Mở lại chấm bổ sung' },
        adminPrincipal,
        requestMeta,
      );
      expect(store.size).toBe(0);
      const afterReopenDetail = await productsService.getPublic('prod-1');
      expect(afterReopenDetail.status).toBe(ProductStatus.SCORING);
      expect(afterReopenDetail.finalScore).toBeNull();
      expect(afterReopenDetail.starRating).toBeNull();
    });

    it('injects RedisService into all four services via NestJS RedisModule DI', async () => {
      const originalRedisUrl = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      @Module({
        imports: [RedisModule],
        providers: [
          { provide: ProductsRepository, useValue: {} },
          { provide: AdminCatalogsRepository, useValue: {} },
          { provide: AdminRepository, useValue: {} },
          { provide: EvaluationsRepository, useValue: {} },
          ProductsService,
          AdminCatalogsService,
          AdminService,
          EvaluationsService,
        ],
      })
      class CacheDiTestModule {}

      const app = await NestFactory.createApplicationContext(
        CacheDiTestModule,
        { logger: false },
      );
      try {
        const redis = app.get(RedisService);
        for (const ServiceClass of [
          ProductsService,
          AdminCatalogsService,
          AdminService,
          EvaluationsService,
        ]) {
          const instance = app.get<{ redis?: RedisService }>(ServiceClass);
          expect(instance.redis).toBe(redis);
        }
      } finally {
        await app.close();
        if (originalRedisUrl === undefined) {
          delete process.env.REDIS_URL;
        } else {
          process.env.REDIS_URL = originalRedisUrl;
        }
      }
    });
  });
});
