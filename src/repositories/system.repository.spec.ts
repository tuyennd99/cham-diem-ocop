import { PrismaService } from '../prisma/prisma.service';
import { SystemService } from '../services/system.service';
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
  permissionGroups: [],
};

const editorGroup = {
  id: 7,
  code: 'EDITOR',
  permissions: [{ permission: { code: 'tasks.update' } }],
};

describe('SystemRepository grant transactions', () => {
  it('revalidates grants inside a serializable retry', async () => {
    let attempts = 0;
    const isolationLevels: unknown[] = [];
    const rootActor = {
      status: 'ACTIVE',
      organizationId: 10,
      permissionGroups: [
        {
          permissionGroup: {
            code: 'EDITOR',
            permissions: [{ permission: { code: 'tasks.update' } }],
          },
        },
      ],
    };
    const transactionFor = (attempt: number) => ({
      user: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          organizationId: 10,
          permissionGroups: [
            {
              permissionGroup: {
                code: 'EDITOR',
                permissions: [
                  {
                    permission: {
                      code: attempt === 1 ? 'tasks.update' : 'users.manage',
                    },
                  },
                ],
              },
            },
          ],
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(targetUser),
        update: jest.fn().mockResolvedValue(targetUser),
      },
      permissionGroup: {
        findMany: jest.fn().mockResolvedValue([editorGroup]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    });
    const prisma = {
      user: {
        findFirst: jest
          .fn()
          .mockImplementation((args: { select: { fullName?: boolean } }) =>
            Promise.resolve(args.select.fullName ? targetUser : rootActor),
          ),
      },
      permissionGroup: {
        findMany: jest.fn().mockResolvedValue([editorGroup]),
      },
      $transaction: jest.fn(
        async (
          callback: (
            transaction: ReturnType<typeof transactionFor>,
          ) => Promise<unknown>,
          options?: { isolationLevel?: unknown },
        ) => {
          attempts += 1;
          isolationLevels.push(options?.isolationLevel);
          const result = await callback(transactionFor(attempts));
          if (attempts === 1) {
            const conflict = Object.assign(new Error('write conflict'), {
              code: 'P2034',
            });
            throw conflict;
          }
          return result;
        },
      ),
    };
    const repository = new SystemRepository(prisma as unknown as PrismaService);
    const service = new SystemService(repository);

    await expect(
      service.updateUser(9, { permissionGroupIds: [7] }, 8, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'PRIVILEGE_ESCALATION',
        message: 'Cannot grant permissions you do not have',
      },
    });
    expect(attempts).toBe(2);
    expect(isolationLevels).toEqual(['Serializable', 'Serializable']);
  });
});
