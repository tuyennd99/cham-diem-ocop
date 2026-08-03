import { PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '../../src/prisma/client';
import { DEFAULT_SEED_PASSWORD, hashSeedPassword } from './password';
import { ADMIN_GROUP_CODE } from '../../src/constants/role';
import { seedDefaultAdmin } from './admin';
import { MAP_PERMISSIONS, LIST_PERMISSIONS } from '../../src/constants/permission';

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const groups = {
  ADMIN: LIST_PERMISSIONS.map(([code]) => code),
  THUONG_TRUC: [
    MAP_PERMISSIONS.TASKS_READ,
    MAP_PERMISSIONS.TASKS_READ_ALL,
    MAP_PERMISSIONS.TASKS_CREATE,
    MAP_PERMISSIONS.TASKS_UPDATE,
    MAP_PERMISSIONS.TASKS_DELETE,
    MAP_PERMISSIONS.TASKS_ASSIGN,
    MAP_PERMISSIONS.TASKS_CLOSE,
    MAP_PERMISSIONS.TASKS_COMPLETE,
    MAP_PERMISSIONS.CONSOLIDATED_REVIEW,
    MAP_PERMISSIONS.REPORT_HISTORY_READ,
    MAP_PERMISSIONS.DASHBOARD_READ,
    MAP_PERMISSIONS.DASHBOARD_READ_ALL,
    MAP_PERMISSIONS.AUDIT_READ,
  ],
  DON_VI: [
    MAP_PERMISSIONS.TASKS_READ,
    MAP_PERMISSIONS.PROGRESS_EDIT,
    MAP_PERMISSIONS.PROGRESS_SUBMIT,
    MAP_PERMISSIONS.PROGRESS_REVIEW,
    MAP_PERMISSIONS.CONSOLIDATED_EDIT,
    MAP_PERMISSIONS.CONSOLIDATED_SUBMIT,
    MAP_PERMISSIONS.REPORT_HISTORY_READ,
    MAP_PERMISSIONS.DASHBOARD_READ,
  ],
  VIEWER: [MAP_PERMISSIONS.TASKS_READ, MAP_PERMISSIONS.REPORT_HISTORY_READ, MAP_PERMISSIONS.DASHBOARD_READ],
} as const;


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

  for (const [code, name] of LIST_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }

  for (const [code, permissionCodes] of Object.entries(groups)) {
    const group = await prisma.permissionGroup.upsert({
      where: { code },
      update: { name: code },
      create: { code, name: code },
    });
    const selected = await prisma.permission.findMany({
      where: { code: { in: [...permissionCodes] } },
    });
    await prisma.permissionGroupPermission.deleteMany({
      where: { permissionGroupId: group.id },
    });
    await prisma.permissionGroupPermission.createMany({
      data: selected.map((permission) => ({
        permissionGroupId: group.id,
        permissionId: permission.id,
      })),
    });
  }

  const adminGroup = await prisma.permissionGroup.findUniqueOrThrow({
    where: { code: ADMIN_GROUP_CODE },
  });
  const admin = await seedDefaultAdmin(prisma, {
    passwordHash,
    organizationId: technicalAdmin.id,
  });
  await prisma.userPermissionGroup.upsert({
    where: {
      userId_permissionGroupId: {
        userId: admin.id,
        permissionGroupId: adminGroup.id,
      },
    },
    update: {},
    create: { userId: admin.id, permissionGroupId: adminGroup.id },
  });
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
