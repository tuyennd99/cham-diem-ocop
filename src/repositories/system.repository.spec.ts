import { PrismaService } from '../prisma/prisma.service';
import { SystemRepository } from './system.repository';

describe('SystemRepository user deletion', () => {
  it('removes user-group memberships before soft-deleting the user', async () => {
    const transaction = {
      userGroupMember: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 7 }),
      },
      refreshSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const repository = new SystemRepository(prisma as unknown as PrismaService);
    const deletedAt = new Date('2026-07-29T00:00:00.000Z');

    await repository.deleteUser(7, 3, deletedAt, {});

    expect(transaction.userGroupMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7 },
    });
    expect(
      transaction.userGroupMember.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(transaction.user.update.mock.invocationCallOrder[0]);
  });
});
