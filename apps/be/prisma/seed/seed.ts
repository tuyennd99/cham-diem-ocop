import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient, Role, StaffPermission } from '@prisma/client';
import { databaseObject } from '../../src/prisma/sql';
import bcrypt from 'bcryptjs';
import { createPrismaAdapter } from '../../src/prisma/client';
import { PASSWORD_MAX_BYTES, PASSWORD_ROUNDS } from '../../src/constants/auth';

type CategorySeed = {
  id: string;
  groupCode: string;
  groupName: string;
  classificationGroup: string;
  classificationSubgroup: string | null;
  name: string;
  criteriaSetKey: string;
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
      staffPermissions: [StaffPermission.MANAGE, StaffPermission.VIEW],
      verified: true,
      isActive: true,
    },
  });
}

async function main() {
  const criteriaSets = loadCriteriaSets();
  validateCriteriaSets(criteriaSets);
  const categoryByKey = new Map<string, string>();
  const setsByKey = new Map(criteriaSets.map((set) => [set.categoryKey, set]));
  const categoryIds = catalog.categories.map(({ id }) => id);
  const groupCodes = [
    ...new Set(catalog.categories.map(({ groupCode }) => groupCode)),
  ].sort();
  await prisma.$transaction(
    async (tx) => {
      const existingCategories = await tx.productCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { groupId: true },
      });
      const existingGroupIds = [
        ...new Set(existingCategories.map(({ groupId }) => groupId)),
      ];
      const groupsToLock = await tx.productGroup.findMany({
        where: {
          OR: [{ code: { in: groupCodes } }, { id: { in: existingGroupIds } }],
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      const lockedGroupIds = groupsToLock.map(({ id }) => id);
      if (lockedGroupIds.length) {
        await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM ${databaseObject('product_groups')}
        WHERE "id" IN (${Prisma.join(lockedGroupIds)})
        ORDER BY "id" FOR UPDATE
      `);
      }
      const groupsByCode = new Map<
        string,
        { id: string; code: string; name: string }
      >();
      const groups = [
        ...new Map(
          catalog.categories.map(({ groupCode, groupName }) => [
            groupCode,
            groupName,
          ]),
        ),
      ].sort(([a], [b]) => a.localeCompare(b));
      for (const [index, [code, name]] of groups.entries()) {
        const group = await tx.productGroup.upsert({
          where: { code },
          update: {},
          create: {
            id: 'product-group-' + code,
            code,
            name,
            order: index + 1,
            isActive: true,
          },
          select: { id: true, code: true, name: true },
        });
        groupsByCode.set(code, group);
      }
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM ${databaseObject('product_categories')}
        WHERE "id" IN (${Prisma.join(categoryIds)})
        ORDER BY "id" FOR UPDATE
      `);

      const currentCategories = await tx.productCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, groupId: true },
      });
      if (
        currentCategories.some(
          ({ groupId }) => !lockedGroupIds.includes(groupId),
        )
      ) {
        throw new Error(
          'Catalog group relation changed while seeding; retry after catalog updates finish',
        );
      }

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

      for (const [index, category] of catalog.categories.entries()) {
        const group = groupsByCode.get(category.groupCode)!;
        const row = await tx.productCategory.upsert({
          where: { id: category.id },
          update: {},
          create: {
            id: category.id,
            groupId: group.id,
            groupCode: group.code,
            groupName: group.name,
            classificationGroup: category.classificationGroup,
            classificationSubgroup: category.classificationSubgroup,
            name: category.name,
            order: index + 1,
            isActive: true,
          },
          select: { id: true },
        });
        categoryByKey.set(category.criteriaSetKey, row.id);
      }

      for (const seed of criteriaSets) {
        const categoryId = categoryByKey.get(seed.categoryKey);
        if (!categoryId)
          throw new Error(`Unknown criteria category ${seed.categoryKey}`);
        const sourceHash = createHash('sha256')
          .update(JSON.stringify(incomingScoringProjection(seed)))
          .digest('hex');
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
}
main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
