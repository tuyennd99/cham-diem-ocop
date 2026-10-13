import { Prisma } from '@prisma/client';
import { seedDefaultAdminInTransaction } from '../../prisma/seed/admin';

describe('seedDefaultAdminInTransaction', () => {
  it('uses the supplied transaction without starting a nested transaction', async () => {
    const admin = { id: 1, username: 'admin' };
    const transaction = {
      $transaction: () => {
        throw new Error('nested transaction');
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([]),
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(admin),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      seedDefaultAdminInTransaction(transaction, {
        passwordHash: 'hash',
        organizationId: 1,
      }),
    ).resolves.toBe(admin);
  });
});
