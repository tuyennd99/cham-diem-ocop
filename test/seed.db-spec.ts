import { Prisma, PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '../src/prisma/client';
import { seedDefaultAdmin } from '../prisma/seed/admin';

const testUrl = process.env.TEST_DATABASE_URL;
if (
  !testUrl ||
  !/^postgresql:\/\/[^/]+@(?:127\.0\.0\.1|localhost):5433\/congan_task_test(?:\?|$)/.test(
    testUrl,
  )
) {
  throw new Error(
    'TEST_DATABASE_URL must target congan_task_test on localhost:5433',
  );
}

process.env.DATABASE_URL = testUrl;

describe('default admin seed', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: createPrismaAdapter(testUrl) });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('creates admin as id 1 and advances the users sequence', async () => {
    await withRollback(prisma, async (tx) => {
      const organization = await createOrganization(tx);
      const admin = await seedDefaultAdmin(tx, {
        passwordHash: 'hash',
        organizationId: organization.id,
      });
      const next = await tx.user.create({
        data: {
          username: `next-user-${organization.id}`,
          fullName: 'Next user',
          passwordHash: 'hash',
          organizationId: organization.id,
        },
      });

      expect(admin.id).toBe(1);
      expect(next.id).toBeGreaterThan(1);
    });
  });

  it('does not lower an advanced users sequence', async () => {
    await withRollback(prisma, async (tx) => {
      const organization = await createOrganization(tx);
      await tx.$queryRaw(
        Prisma.sql`SELECT setval(pg_get_serial_sequence('users', 'id')::regclass, 1000000)`,
      );

      await seedDefaultAdmin(tx, {
        passwordHash: 'hash',
        organizationId: organization.id,
      });
      const next = await tx.user.create({
        data: {
          username: `high-water-${organization.id}`,
          fullName: 'High water user',
          passwordHash: 'hash',
          organizationId: organization.id,
        },
      });

      expect(next.id).toBeGreaterThan(1_000_000);
    });
  });

  it('fails when id 1 belongs to another username', async () => {
    await withRollback(prisma, async (tx) => {
      const organization = await createOrganization(tx);
      await tx.user.create({
        data: {
          id: 1,
          username: 'occupied',
          fullName: 'Occupied',
          passwordHash: 'hash',
          organizationId: organization.id,
        },
      });

      await expect(
        seedDefaultAdmin(tx, {
          passwordHash: 'hash',
          organizationId: organization.id,
        }),
      ).rejects.toThrow('User id 1 is reserved for admin');
    });
  });

  it('reactivates an existing default admin', async () => {
    await withRollback(prisma, async (tx) => {
      const organization = await createOrganization(tx);
      await seedDefaultAdmin(tx, {
        passwordHash: 'hash',
        organizationId: organization.id,
      });
      await tx.user.update({
        where: { id: 1 },
        data: { status: 'LOCKED', lockedAt: new Date(), deletedAt: new Date() },
      });

      const admin = await seedDefaultAdmin(tx, {
        passwordHash: 'hash',
        organizationId: organization.id,
      });

      expect(admin).toMatchObject({
        id: 1,
        status: 'ACTIVE',
        lockedAt: null,
        lockedUntil: null,
        deletedAt: null,
      });
    });
  });

  it('fails when admin belongs to another id', async () => {
    await withRollback(prisma, async (tx) => {
      const organization = await createOrganization(tx);
      await tx.user.create({
        data: {
          id: 2,
          username: 'admin',
          fullName: 'Admin elsewhere',
          passwordHash: 'hash',
          organizationId: organization.id,
        },
      });

      await expect(
        seedDefaultAdmin(tx, {
          passwordHash: 'hash',
          organizationId: organization.id,
        }),
      ).rejects.toThrow('Admin must use user id 1');
    });
  });
});

async function createOrganization(prisma: Prisma.TransactionClient) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return prisma.organization.create({
    data: { code: `seed-${suffix}`, name: `Seed ${suffix}` },
  });
}

async function withRollback(
  prisma: PrismaClient,
  run: (transaction: Prisma.TransactionClient) => Promise<void>,
) {
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`TRUNCATE TABLE "users" CASCADE`);
      await run(transaction);
      throw new Rollback();
    });
  } catch (error) {
    if (error instanceof Rollback) return;
    throw error;
  } finally {
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(
        Prisma.sql`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`,
      );
      await transaction.$queryRaw(
        Prisma.sql`
          SELECT setval(
            pg_get_serial_sequence('users', 'id')::regclass,
            GREATEST(
              COALESCE((SELECT MAX(id) FROM users), 1),
              COALESCE(
                pg_sequence_last_value(pg_get_serial_sequence('users', 'id')::regclass),
                1
              )
            )
          )
        `,
      );
    });
  }
}

class Rollback extends Error {}
