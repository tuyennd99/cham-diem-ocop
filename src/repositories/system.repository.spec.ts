import { PrismaService } from '../prisma/prisma.service';
import { SystemRepository } from './system.repository';

const targetUser = {
  id: 9,
  username: 'managed-user',
  fullName: 'Managed User',
  position: null,
  rank: null,
  phone: null,
  organizationId: 10,
  status: 'ACTIVE',
  createdAt: new Date('2026-07-30T00:00:00.000Z'),
  updatedAt: new Date('2026-07-30T00:00:00.000Z'),
  organization: { id: 10, code: 'UNIT', name: 'Test Unit' },
};

describe('SystemRepository user writes', () => {
  it('creates a user and writes an audit entry without group data', async () => {
    const audits: Array<Record<string, unknown>> = [];
    const transaction = {
      user: { create: jest.fn().mockResolvedValue(targetUser) },
      auditLog: {
        create: jest
          .fn()
          .mockImplementation((args: { data: Record<string, unknown> }) => {
            audits.push(args.data);
            return Promise.resolve(undefined);
          }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const repository = new SystemRepository(prisma as unknown as PrismaService);

    const result = await repository.createUser(
      {
        username: 'managed-user',
        fullName: 'Managed User',
        passwordHash: 'hash',
        organizationId: 10,
      },
      1,
      {},
    );

    expect(result).toBe(targetUser);
    // jest.fn() without generics types .mock.calls as any[][]; the `as` cast
    // below recovers the shape we actually need.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const createArg = transaction.user.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(createArg.data).not.toHaveProperty('permissionGroups');
    expect(audits[0].action).toBe('SYSTEM_USER_CREATED');
    expect(audits[0].afterData).not.toHaveProperty('permissionGroupIds');
  });
});
