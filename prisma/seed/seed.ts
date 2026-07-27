import { createPrismaAdapter, PrismaClient } from '../../src/prisma/client';
import { hashSeedPassword } from './password';

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

const permissions = [
  ['tasks.read', 'Xem nhiệm vụ'],
  ['tasks.create', 'Tạo nhiệm vụ'],
  ['tasks.update', 'Sửa nhiệm vụ'],
  ['tasks.delete', 'Xóa mềm nhiệm vụ'],
  ['tasks.assign', 'Phân công đơn vị'],
  ['tasks.close', 'Đóng nhiệm vụ định kỳ'],
  ['tasks.complete', 'Hoàn thành nhiệm vụ đột xuất'],
  ['progress.edit', 'Soạn báo cáo tiến độ'],
  ['progress.submit', 'Gửi báo cáo tiến độ'],
  ['progress.review', 'Duyệt/trả báo cáo tiến độ'],
  ['consolidated.edit', 'Soạn báo cáo tổng hợp'],
  ['consolidated.submit', 'Gửi báo cáo tổng hợp'],
  ['consolidated.review', 'Duyệt/trả báo cáo tổng hợp'],
  ['report_history.read', 'Xem lịch sử báo cáo'],
  ['dashboard.read', 'Xem dashboard'],
  ['users.manage', 'Quản lý người dùng'],
  ['organizations.manage', 'Quản lý đơn vị'],
  ['programs.manage', 'Quản lý chương trình'],
  ['permission_groups.manage', 'Quản lý nhóm quyền'],
  ['audit.read', 'Xem audit log'],
] as const;

const groups = {
  ADMIN: permissions.map(([code]) => code),
  THUONG_TRUC: [
    'tasks.read',
    'tasks.create',
    'tasks.update',
    'tasks.delete',
    'tasks.assign',
    'tasks.close',
    'tasks.complete',
    'consolidated.review',
    'report_history.read',
    'dashboard.read',
    'audit.read',
  ],
  DON_VI: [
    'tasks.read',
    'progress.edit',
    'progress.submit',
    'progress.review',
    'consolidated.edit',
    'consolidated.submit',
    'report_history.read',
    'dashboard.read',
  ],
  VIEWER: ['tasks.read', 'report_history.read', 'dashboard.read'],
} as const;

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password)
    throw new Error(
      'SEED_ADMIN_PASSWORD is required to seed the sample admin account.',
    );
  const passwordHash = await hashSeedPassword(password);

  const [technicalAdmin, standingOffice, sampleUnit] = await Promise.all([
    prisma.organization.upsert({
      where: { code: 'ADMIN' },
      update: {
        name: 'Quản trị kỹ thuật',
        isAssigningAuthority: false,
        isExecutingUnit: false,
      },
      create: {
        code: 'ADMIN',
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

  for (const [code, name] of permissions) {
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
    where: { code: 'ADMIN' },
  });
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Quản trị viên mẫu',
      passwordHash,
      organizationId: technicalAdmin.id,
    },
    create: {
      username: 'admin',
      fullName: 'Quản trị viên mẫu',
      passwordHash,
      organizationId: technicalAdmin.id,
    },
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
