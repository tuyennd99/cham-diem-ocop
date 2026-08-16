import { PrismaClient } from '@prisma/client';
import { createPrismaAdapter } from '../../src/prisma/client';
import { DEFAULT_SEED_PASSWORD, hashSeedPassword } from './password';
import { ADMIN_GROUP_CODE } from '../../src/constants/role';
import { seedDefaultAdmin } from './admin';
import donViData from './donvi.json';
import organizationRoleSnapshot from './organizations.json';

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

// organizations.json is a snapshot of the live role configuration (which org is
// the assigning authority, which are executing units), keyed by code. It must
// be re-exported if roles change in the running system, or re-running the seed
// would revert them to this snapshot.
const roleFlagsByCode = new Map(
  organizationRoleSnapshot.map((organization) => [
    organization.code.trim(),
    {
      isAssigningAuthority: organization.isAssigningAuthority,
      isExecutingUnit: organization.isExecutingUnit,
    },
  ]),
);

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_PASSWORD;
  const passwordHash = await hashSeedPassword(password);
  const technicalAdmin = await prisma.organization.upsert({
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
  });

  const organizations = await Promise.all(
    donViData.map((donVi) => {
      const code = donVi['Mã đơn vị'].trim();
      const name = donVi['Tên đơn vị đầy đủ'].trim();
      const flags = roleFlagsByCode.get(code) ?? {
        isAssigningAuthority: false,
        isExecutingUnit: true,
      };
      return prisma.organization.upsert({
        where: { code },
        update: { name, ...flags },
        create: { code, name, ...flags },
      });
    }),
  );
  const admin = await seedDefaultAdmin(prisma, {
    passwordHash,
    organizationId: technicalAdmin.id,
  });
  const assigningOrganization = organizations.find(
    (organization) => organization.isAssigningAuthority,
  );
  if (!assigningOrganization) {
    throw new Error('Seed data has no organization with isAssigningAuthority');
  }
  const leadOrganization = organizations.find(
    (organization) => organization.isExecutingUnit,
  )!;
  const collaboratorOrganization = organizations.find(
    (organization) => organization.id !== leadOrganization.id,
  )!;

  const program = await prisma.program.upsert({
    where: { code: 'NQ57' },
    update: {
      name: 'Nghị quyết 57',
      assigningOrganizationId: assigningOrganization.id,
      leadOrganizationId: leadOrganization.id,
    },
    create: {
      code: 'NQ57',
      name: 'Nghị quyết 57',
      description: 'Chương trình mẫu khởi tạo.',
      assigningOrganizationId: assigningOrganization.id,
      leadOrganizationId: leadOrganization.id,
    },
  });

  await prisma.programCollaborator.upsert({
    where: {
      programId_organizationId: {
        programId: program.id,
        organizationId: collaboratorOrganization.id,
      },
    },
    update: {},
    create: {
      programId: program.id,
      organizationId: collaboratorOrganization.id,
    },
  });

  const tasks = await Promise.all([
    prisma.task.upsert({
      where: { code: 'NQ57-01' },
      update: {
        name: 'Nhiệm vụ mẫu 1',
        programId: program.id,
        updatedById: admin.id,
        assigningOrganizationId: assigningOrganization.id,
        leadOrganizationId: leadOrganization.id,
      },
      create: {
        code: 'NQ57-01',
        name: 'Nhiệm vụ mẫu 1',
        type: 'DOT_XUAT',
        programId: program.id,
        createdById: admin.id,
        updatedById: admin.id,
        assigningOrganizationId: assigningOrganization.id,
        leadOrganizationId: leadOrganization.id,
      },
    }),
    prisma.task.upsert({
      where: { code: 'NQ57-02' },
      update: {
        name: 'Nhiệm vụ mẫu 2',
        programId: program.id,
        updatedById: admin.id,
        assigningOrganizationId: assigningOrganization.id,
        leadOrganizationId: leadOrganization.id,
      },
      create: {
        code: 'NQ57-02',
        name: 'Nhiệm vụ mẫu 2',
        type: 'DINH_KY',
        programId: program.id,
        createdById: admin.id,
        updatedById: admin.id,
        assigningOrganizationId: assigningOrganization.id,
        leadOrganizationId: leadOrganization.id,
      },
    }),
  ]);

  await Promise.all(
    tasks.map((task) =>
      prisma.taskCollaborator.upsert({
        where: {
          taskId_organizationId: {
            taskId: task.id,
            organizationId: collaboratorOrganization.id,
          },
        },
        update: {},
        create: {
          taskId: task.id,
          organizationId: collaboratorOrganization.id,
        },
      }),
    ),
  );
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
