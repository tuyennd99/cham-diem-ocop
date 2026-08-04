import { PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '../../src/prisma/client';
import { DEFAULT_SEED_PASSWORD, hashSeedPassword } from './password';
import { ADMIN_GROUP_CODE } from '../../src/constants/role';
import { seedDefaultAdmin } from './admin';

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_PASSWORD;
  const passwordHash = await hashSeedPassword(password);

  const [technicalAdmin, standingOffice, sampleUnit] = await Promise.all([
    prisma.organization.upsert({
      where: { code: ADMIN_GROUP_CODE },
      update: {
        name: 'Quản trị kỹ thuật',
        isAssigningAuthority: false,
        isExecutingUnit: false,
      },
      create: {
        code: ADMIN_GROUP_CODE,
        name: 'Quản trị kỹ thuật',
        isAssigningAuthority: false,
        isExecutingUnit: false,
      },
    }),
    prisma.organization.upsert({
      where: { code: 'THUONG_TRUC' },
      update: { name: 'Thường trực nghiệp vụ', isAssigningAuthority: true },
      create: {
        code: 'THUONG_TRUC',
        name: 'Thường trực nghiệp vụ',
        isAssigningAuthority: true,
      },
    }),
    prisma.organization.upsert({
      where: { code: 'DON_VI_MAU' },
      update: { name: 'Đơn vị nghiệp vụ mẫu' },
      create: { code: 'DON_VI_MAU', name: 'Đơn vị nghiệp vụ mẫu' },
    }),
  ]);
  void standingOffice;
  void sampleUnit;

  await prisma.program.upsert({
    where: { code: 'NQ57' },
    update: { name: 'Nghị quyết 57' },
    create: {
      code: 'NQ57',
      name: 'Nghị quyết 57',
      description: 'Chương trình mẫu khởi tạo.',
    },
  });

  const admin = await seedDefaultAdmin(prisma, {
    passwordHash,
    organizationId: technicalAdmin.id,
  });

}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
