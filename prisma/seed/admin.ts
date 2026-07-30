import { Prisma, type PrismaClient } from '@prisma/client';

export async function seedDefaultAdmin(
  prisma: PrismaClient,
  input: { passwordHash: string; organizationId: number },
) {
  return prisma.$transaction((transaction) =>
    seedDefaultAdminInTransaction(transaction, input),
  );
}

export async function seedDefaultAdminInTransaction(
  prisma: Prisma.TransactionClient,
  input: { passwordHash: string; organizationId: number },
) {
  await prisma.$executeRaw(
    Prisma.sql`LOCK TABLE "users" IN SHARE ROW EXCLUSIVE MODE`,
  );
  const [idOne, namedAdmin] = await Promise.all([
    prisma.user.findUnique({ where: { id: 1 } }),
    prisma.user.findUnique({ where: { username: 'admin' } }),
  ]);
  if (idOne && idOne.username !== 'admin') {
    throw new Error('User id 1 is reserved for admin');
  }
  if (namedAdmin && namedAdmin.id !== 1) {
    throw new Error('Admin must use user id 1');
  }

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Quản trị viên mẫu',
      passwordHash: input.passwordHash,
      organizationId: input.organizationId,
      status: 'ACTIVE',
      lockedAt: null,
      lockedUntil: null,
      lockReason: null,
      deletedAt: null,
    },
    create: {
      id: 1,
      username: 'admin',
      fullName: 'Quản trị viên mẫu',
      passwordHash: input.passwordHash,
      organizationId: input.organizationId,
    },
  });
  await prisma.$queryRaw(
    Prisma.sql`
      SELECT setval(
        pg_get_serial_sequence('users', 'id')::regclass,
        GREATEST(
          (SELECT MAX(id) FROM users),
          COALESCE(
            pg_sequence_last_value(pg_get_serial_sequence('users', 'id')::regclass),
            1
          )
        )
      )
    `,
  );
  return admin;
}
