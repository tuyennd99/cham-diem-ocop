import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminRepository } from './admin.repository';

describe('AdminRepository.replaceAssignments', () => {
  it('names the category and missing criterion when open work would be left uncovered', async () => {
    const transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: { findMany: jest.fn().mockResolvedValue([]) },
      judgeAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      product: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'product-1', categoryId: 'category-1' }]),
      },
      productCategory: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: 'category-1',
              name: 'Thực phẩm',
              groupName: 'Nông sản',
              criteriaSet: { criteria: [{ id: 'criterion-1', code: '1.1' }] },
            },
          ]),
      },
    };
    const prisma = {
      $transaction: jest.fn((operation: (tx: typeof transaction) => unknown) =>
        operation(transaction),
      ),
    };
    const repository = new AdminRepository(prisma as unknown as PrismaService);
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://127.0.0.1/ocop_test?schema=public';
    try {
      await expect(
        repository.replaceAssignments([], 'admin-1', undefined, {}),
      ).rejects.toThrow(
        new ConflictException(
          'Phân công chưa phủ đủ tiêu chí cho Nông sản · Thực phẩm: chưa có giám khảo',
        ),
      );
      expect(transaction.judgeAssignment.findMany).toHaveBeenCalled();
    } finally {
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
