import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient, Role, StaffPermission } from '@prisma/client';
import { databaseObject } from '../../src/prisma/sql';
import bcrypt from 'bcryptjs';
import { createPrismaAdapter } from '../../src/prisma/client';
import { PASSWORD_MAX_BYTES, PASSWORD_ROUNDS } from '../../src/constants/auth';
import { seedSampleOcopData } from './sample-data';

type CategorySeed = {
  id: string;
  name: string;
  criteriaSetKey: string;
  order: number;
};

type CriteriaSeed = {
  code: string;
  name: string;
  maxScore: number;
  order: number;
  sectionCode: string;
  sectionName: string;
  subCriteria: Array<{
    code: string;
    content: string;
    order: number;
    options: Array<{ label: string; points: number }>;
  }>;
};

type CriteriaDocument = {
  criteriaSets: Array<{
    categoryKey: string;
    name: string;
    source: string;
    criteria: CriteriaSeed[];
  }>;
};

export const OFFICIAL_MANAGING_AGENCIES = [
  {
    id: 'agency-bnnmt',
    code: 'BNNMT',
    name: 'Bộ Nông nghiệp và Môi trường',
    order: 1,
  },
  {
    id: 'agency-bct',
    code: 'BCT',
    name: 'Bộ Công Thương',
    order: 2,
  },
  {
    id: 'agency-byt',
    code: 'BYT',
    name: 'Bộ Y tế',
    order: 3,
  },
  {
    id: 'agency-bvhttdl',
    code: 'BVHTTDL',
    name: 'Bộ Văn hóa, Thể thao và Du lịch',
    order: 4,
  },
] as const;

export const OFFICIAL_CATEGORY_AGENCIES: Record<string, string[]> = {
  'fresh-produce': ['agency-bnnmt'],
  'fresh-animal-products': ['agency-bnnmt'],
  'processed-grains': ['agency-bnnmt'],
  'honey-and-other-agri-food': ['agency-bnnmt'],
  'ready-to-eat': ['agency-bct'],
  'grain-products': ['agency-bnnmt', 'agency-bct'],
  'processed-produce': ['agency-bnnmt'],
  'processed-animal-and-agri-food': ['agency-bnnmt', 'agency-bct'],
  'liquid-condiments': ['agency-bnnmt'],
  'other-condiments': ['agency-bnnmt'],
  tea: ['agency-bnnmt'],
  'herbal-tea': ['agency-bnnmt'],
  'coffee-cocoa': ['agency-bnnmt'],
  'white-liquor': ['agency-bct'],
  'other-alcoholic-drinks': ['agency-bct'],
  'bottled-water': ['agency-byt'],
  'other-non-alcoholic-drinks': ['agency-bct'],
  'herbal-functional-products': ['agency-byt'],
  'herbal-cosmetics': ['agency-byt'],
  'essential-oils-and-herbs': ['agency-byt', 'agency-bct'],
  handicraft: ['agency-bct', 'agency-bnnmt'],
  'textiles-apparel': ['agency-bct'],
  flowers: ['agency-bnnmt'],
  'ornamental-plants': ['agency-bnnmt'],
  'ornamental-animals': ['agency-bnnmt'],
  'community-ecotourism': ['agency-bvhttdl', 'agency-bnnmt'],
};

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });
const dataDir = join(process.cwd(), 'prisma', 'seed-data');
const catalog = JSON.parse(
  readFileSync(join(dataDir, 'categories.json'), 'utf8'),
) as {
  categories: CategorySeed[];
};

function loadCriteriaSets(): CriteriaDocument['criteriaSets'] {
  return readdirSync(dataDir)
    .filter(
      (file) => file.startsWith('criteria-sets') && file.endsWith('.json'),
    )
    .sort()
    .flatMap(
      (file) =>
        (
          JSON.parse(
            readFileSync(join(dataDir, file), 'utf8'),
          ) as CriteriaDocument
        ).criteriaSets,
    );
}

function validateCriteriaSets(criteriaSets: CriteriaDocument['criteriaSets']) {
  const categoriesByKey = new Set(
    catalog.categories.map((category) => category.criteriaSetKey),
  );
  const setsByKey = new Map(criteriaSets.map((set) => [set.categoryKey, set]));
  if (
    setsByKey.size !== catalog.categories.length ||
    categoriesByKey.size !== catalog.categories.length ||
    [...categoriesByKey].some((key) => !setsByKey.has(key))
  ) {
    throw new Error(
      'Seed requires exactly one official criteria set for every product category',
    );
  }
  for (const set of criteriaSets) {
    const total = set.criteria.reduce((sum, criterion) => {
      const maxFromOptions = criterion.subCriteria.reduce(
        (criterionSum, subCriterion) =>
          criterionSum +
          Math.max(...subCriterion.options.map((option) => option.points)),
        0,
      );
      if (
        !criterion.subCriteria.length ||
        criterion.maxScore !== maxFromOptions
      ) {
        throw new Error(
          `Invalid maximum points for ${set.categoryKey}, criterion ${criterion.code}`,
        );
      }
      return sum + criterion.maxScore;
    }, 0);
    if (total !== 100 || !set.criteria.length) {
      throw new Error(
        `Criteria set ${set.categoryKey} must total exactly 100 points`,
      );
    }
  }
}

function compareOrder<T extends { order: number; code: string }>(a: T, b: T) {
  return a.order - b.order || a.code.localeCompare(b.code);
}

function scoringProjection(set: {
  name: string | null;
  source: string | null;
  criteria: Array<{
    code: string;
    name: string;
    maxScore: number;
    order: number;
    sectionCode: string;
    sectionName: string;
    subCriteria: Array<{
      code: string;
      content: string;
      order: number;
      options: Array<{ label: string; points: number; order: number }>;
    }>;
  }>;
}) {
  return {
    name: set.name,
    source: set.source,
    criteria: [...set.criteria].sort(compareOrder).map((criterion) => ({
      code: criterion.code,
      name: criterion.name,
      maxScore: criterion.maxScore,
      order: criterion.order,
      sectionCode: criterion.sectionCode,
      sectionName: criterion.sectionName,
      subCriteria: [...criterion.subCriteria].sort(compareOrder).map((sub) => ({
        code: sub.code,
        content: sub.content,
        order: sub.order,
        options: [...sub.options]
          .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
          .map(({ label, points, order }) => ({ label, points, order })),
      })),
    })),
  };
}

function incomingScoringProjection(
  set: CriteriaDocument['criteriaSets'][number],
) {
  return scoringProjection({
    name: set.name,
    source: set.source,
    criteria: set.criteria.map((criterion) => ({
      ...criterion,
      subCriteria: criterion.subCriteria.map((sub) => ({
        ...sub,
        options: sub.options.map((option, index) => ({
          ...option,
          order: index + 1,
        })),
      })),
    })),
  });
}

async function seedBootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email && !password) return;
  if (
    !email ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES
  ) {
    throw new Error(
      'Set both BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters and at most 72 UTF-8 bytes',
    );
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== Role.ADMIN)
      throw new Error('Bootstrap email already belongs to a non-admin account');
    return;
  }
  if (await prisma.user.count({ where: { role: Role.ADMIN } })) return;
  await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(password, PASSWORD_ROUNDS),
      fullName: 'Quản trị viên',
      role: Role.ADMIN,
      roles: [Role.ADMIN, Role.VIEWER],
      staffPermissions: [StaffPermission.MANAGE, StaffPermission.VIEW],
      verified: true,
      isActive: true,
    },
  });
}

async function seedTestAccounts() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const isIsolatedTestSchema = /[?&]schema=ocop_test_/i.test(dbUrl);
  if (
    isIsolatedTestSchema &&
    process.env.SEED_TEST_ACCOUNTS !== 'true' &&
    !process.argv.includes('--seed-test-accounts')
  ) {
    return;
  }
  if (process.env.SEED_TEST_ACCOUNTS === 'false') {
    return;
  }

  const defaultPassword =
    process.env.SEED_TEST_PASSWORD &&
    process.env.SEED_TEST_PASSWORD.length >= 12 &&
    Buffer.byteLength(process.env.SEED_TEST_PASSWORD, 'utf8') <=
      PASSWORD_MAX_BYTES
      ? process.env.SEED_TEST_PASSWORD
      : 'OcopTest@2026!';
  const passwordHash = await bcrypt.hash(defaultPassword, PASSWORD_ROUNDS);

  const accounts: Array<{
    email: string;
    fullName: string;
    phone: string;
    role: Role;
    roles: Role[];
    staffPermissions: StaffPermission[];
  }> = [
    {
      email: 'admin@ocop.test',
      fullName: 'Quản trị hệ thống (Quản trị)',
      phone: '0900000001',
      role: Role.ADMIN,
      roles: [Role.ADMIN, Role.VIEWER],
      staffPermissions: [StaffPermission.MANAGE, StaffPermission.VIEW],
    },
    {
      email: 'admin.score@ocop.test',
      fullName: 'Quản trị kiêm Giám khảo (Quản trị + Giám khảo)',
      phone: '0900000002',
      role: Role.ADMIN,
      roles: [Role.ADMIN, Role.VIEWER, Role.JUDGE],
      staffPermissions: [
        StaffPermission.MANAGE,
        StaffPermission.VIEW,
        StaffPermission.SCORE,
      ],
    },
    {
      email: 'viewer@ocop.test',
      fullName: 'Cán bộ Chủ trì (Chủ trì)',
      phone: '0900000003',
      role: Role.VIEWER,
      roles: [Role.VIEWER],
      staffPermissions: [StaffPermission.VIEW],
    },
    {
      email: 'viewer.score@ocop.test',
      fullName: 'Chủ trì kiêm Giám khảo (Chủ trì + Giám khảo)',
      phone: '0900000004',
      role: Role.JUDGE,
      roles: [Role.VIEWER, Role.JUDGE],
      staffPermissions: [StaffPermission.VIEW, StaffPermission.SCORE],
    },
    {
      email: 'judge@ocop.test',
      fullName: 'Giám khảo Hội đồng (Giám khảo)',
      phone: '0900000005',
      role: Role.JUDGE,
      roles: [Role.JUDGE],
      staffPermissions: [StaffPermission.SCORE],
    },
    {
      email: 'registrant@ocop.test',
      fullName: 'Chủ thể OCOP Mẫu (Người dùng)',
      phone: '0900000006',
      role: Role.REGISTRANT,
      roles: [Role.REGISTRANT],
      staffPermissions: [],
    },
  ];

  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {
        fullName: account.fullName,
        phone: account.phone,
        role: account.role,
        roles: account.roles,
        staffPermissions: account.staffPermissions,
        verified: true,
        isActive: true,
      },
      create: {
        email: account.email,
        password: passwordHash,
        fullName: account.fullName,
        phone: account.phone,
        role: account.role,
        roles: account.roles,
        staffPermissions: account.staffPermissions,
        verified: true,
        isActive: true,
      },
    });
  }

  await seedSampleOcopData(prisma, passwordHash);
}

async function seedManagingAgencies(tx: Prisma.TransactionClient) {
  for (const agency of OFFICIAL_MANAGING_AGENCIES) {
    await tx.managingAgency.upsert({
      where: { code: agency.code },
      update: {
        name: agency.name,
        order: agency.order,
        isActive: true,
      },
      create: {
        id: agency.id,
        code: agency.code,
        name: agency.name,
        order: agency.order,
        isActive: true,
      },
    });
  }
}

async function main() {
  if (
    process.argv.includes('--only-sample-data') ||
    process.env.SEED_ONLY_SAMPLE_DATA === 'true'
  ) {
    await prisma.$transaction((tx) => seedManagingAgencies(tx));
    await seedBootstrapAdmin();
    await seedTestAccounts();
    return;
  }
  const criteriaSets = loadCriteriaSets();
  validateCriteriaSets(criteriaSets);
  const categoryByKey = new Map<string, string>();
  const setsByKey = new Map(criteriaSets.map((set) => [set.categoryKey, set]));
  const categoryIds = catalog.categories.map(({ id }) => id);
  await prisma.$transaction(
    async (tx) => {
      await seedManagingAgencies(tx);

      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM ${databaseObject('product_categories')}
        WHERE "id" IN (${Prisma.join(categoryIds)})
        ORDER BY "id" FOR UPDATE
      `);

      const usedCategories = await tx.productCategory.findMany({
        where: {
          id: { in: categoryIds },
          products: { some: { evaluations: { some: {} } } },
        },
        select: {
          id: true,
          criteriaSet: {
            select: {
              name: true,
              source: true,
              criteria: {
                select: {
                  code: true,
                  name: true,
                  maxScore: true,
                  order: true,
                  sectionCode: true,
                  sectionName: true,
                  subCriteria: {
                    select: {
                      code: true,
                      content: true,
                      order: true,
                      options: {
                        select: { label: true, points: true, order: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      const categoriesById = new Map(
        catalog.categories.map((category) => [category.id, category]),
      );
      for (const category of usedCategories) {
        const seedCategory = categoriesById.get(category.id);
        const incoming =
          seedCategory && setsByKey.get(seedCategory.criteriaSetKey);
        if (
          !incoming ||
          !category.criteriaSet ||
          JSON.stringify(scoringProjection(category.criteriaSet)) !==
            JSON.stringify(incomingScoringProjection(incoming))
        ) {
          throw new Error(
            `Cannot alter used scoring criteria for category ${category.id}`,
          );
        }
      }

      const agencies = await tx.managingAgency.findMany();
      const agencyIdByKey = new Map<string, string>();
      for (const ag of agencies) {
        agencyIdByKey.set(ag.id, ag.id);
        agencyIdByKey.set(`agency-${ag.code.toLowerCase()}`, ag.id);
      }

      for (const category of catalog.categories) {
        const row = await tx.productCategory.upsert({
          where: { id: category.id },
          update: {},
          create: {
            id: category.id,
            name: category.name,
            order: category.order,
            isActive: true,
          },
          select: { id: true },
        });
        categoryByKey.set(category.criteriaSetKey, row.id);

        const existingLinks = await tx.productCategoryAgency.count({
          where: { categoryId: row.id },
        });
        if (existingLinks === 0) {
          const defaultAgencyKeys = OFFICIAL_CATEGORY_AGENCIES[row.id] ?? [];
          for (const key of defaultAgencyKeys) {
            const agencyId = agencyIdByKey.get(key);
            if (agencyId) {
              await tx.productCategoryAgency.upsert({
                where: {
                  categoryId_agencyId: { categoryId: row.id, agencyId },
                },
                update: {},
                create: { categoryId: row.id, agencyId },
              });
            }
          }
        }
      }

      const existingSetsByCategory = new Map(
        (
          await tx.criteriaSet.findMany({
            where: { categoryId: { in: categoryIds } },
            select: {
              id: true,
              categoryId: true,
              sourceHash: true,
              _count: { select: { criteria: true } },
            },
          })
        ).map((s) => [s.categoryId, s]),
      );

      for (const seed of criteriaSets) {
        const categoryId = categoryByKey.get(seed.categoryKey);
        if (!categoryId)
          throw new Error(`Unknown criteria category ${seed.categoryKey}`);
        const sourceHash = createHash('sha256')
          .update(JSON.stringify(incomingScoringProjection(seed)))
          .digest('hex');
        const existingSet = existingSetsByCategory.get(categoryId);
        if (
          existingSet &&
          existingSet.sourceHash === sourceHash &&
          existingSet._count.criteria === seed.criteria.length
        ) {
          continue;
        }
        const criteriaSet = await tx.criteriaSet.upsert({
          where: { categoryId },
          update: { name: seed.name, source: seed.source, sourceHash },
          create: {
            categoryId,
            name: seed.name,
            source: seed.source,
            sourceHash,
            version: '1',
          },
          select: { id: true },
        });
        for (const criterionSeed of seed.criteria) {
          const criterion = await tx.criterion.upsert({
            where: {
              setId_code: { setId: criteriaSet.id, code: criterionSeed.code },
            },
            update: {
              name: criterionSeed.name,
              maxScore: criterionSeed.maxScore,
              order: criterionSeed.order,
              sectionCode: criterionSeed.sectionCode,
              sectionName: criterionSeed.sectionName,
            },
            create: {
              setId: criteriaSet.id,
              code: criterionSeed.code,
              name: criterionSeed.name,
              maxScore: criterionSeed.maxScore,
              order: criterionSeed.order,
              sectionCode: criterionSeed.sectionCode,
              sectionName: criterionSeed.sectionName,
            },
            select: { id: true },
          });
          for (const subSeed of criterionSeed.subCriteria) {
            const subCriterion = await tx.subCriterion.upsert({
              where: {
                criterionId_code: {
                  criterionId: criterion.id,
                  code: subSeed.code,
                },
              },
              update: { content: subSeed.content, order: subSeed.order },
              create: {
                criterionId: criterion.id,
                code: subSeed.code,
                content: subSeed.content,
                order: subSeed.order,
              },
              select: { id: true },
            });
            for (const [index, option] of subSeed.options.entries()) {
              await tx.scoreOption.upsert({
                where: {
                  subCriterionId_order: {
                    subCriterionId: subCriterion.id,
                    order: index + 1,
                  },
                },
                update: { label: option.label, points: option.points },
                create: {
                  subCriterionId: subCriterion.id,
                  label: option.label,
                  points: option.points,
                  order: index + 1,
                },
              });
            }
          }
        }
      }
    },
    { timeout: 300000, maxWait: 10000 },
  );
  await seedBootstrapAdmin();
  await seedTestAccounts();
}
main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
