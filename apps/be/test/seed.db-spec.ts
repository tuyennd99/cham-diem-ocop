import { EvaluationStatus, ProductStatus, Role } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaService } from '../src/prisma/prisma.service';
import { withTestApp } from './support/db-app';

const officialDataDir = resolve(__dirname, '../prisma/seed-data');
type SeedSet = {
  categoryKey: string;
  name: string;
  criteria: Array<{
    subCriteria: Array<{ options: Array<{ points: number }> }>;
  }>;
};
const officialCategories = (
  JSON.parse(
    readFileSync(join(officialDataDir, 'categories.json'), 'utf8'),
  ) as {
    categories: Array<{ id: string; criteriaSetKey: string }>;
  }
).categories;

function seedSandbox(mutate: (sets: SeedSet[]) => void = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'ocop-seed-'));
  const dataDir = join(root, 'prisma', 'seed-data');
  mkdirSync(dataDir, { recursive: true });
  for (const file of readdirSync(officialDataDir)) {
    copyFileSync(join(officialDataDir, file), join(dataDir, file));
  }
  writeFileSync(join(root, '.env'), '');
  const files = readdirSync(dataDir)
    .filter(
      (file) => file.startsWith('criteria-sets') && file.endsWith('.json'),
    )
    .sort();
  const documents = files.map((file) => ({
    file,
    document: JSON.parse(readFileSync(join(dataDir, file), 'utf8')) as {
      criteriaSets: SeedSet[];
    },
  }));
  const sets = documents.flatMap(({ document }) => document.criteriaSets);
  mutate(sets);
  for (const { file, document } of documents) {
    writeFileSync(join(dataDir, file), JSON.stringify(document, null, 2));
  }
  return { root, sets };
}

function runSeed(root: string) {
  return spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(require.resolve('tsx')).href,
      resolve(__dirname, '../prisma/seed/seed.ts'),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        DOTENV_CONFIG_PATH: join(root, '.env'),
      },
      encoding: 'utf8',
      timeout: 300000,
    },
  );
}

function officialSets(): SeedSet[] {
  return readdirSync(officialDataDir)
    .filter(
      (file) => file.startsWith('criteria-sets') && file.endsWith('.json'),
    )
    .sort()
    .flatMap((file) => {
      const document = JSON.parse(
        readFileSync(join(officialDataDir, file), 'utf8'),
      ) as {
        criteriaSets: SeedSet[];
      };
      return document.criteriaSets;
    });
}

async function scoringSnapshot(prisma: PrismaService, categoryIds: string[]) {
  const categories = await prisma.productCategory.findMany({
    where: { id: { in: categoryIds } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      criteriaSet: {
        select: {
          id: true,
          name: true,
          source: true,
          criteria: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              code: true,
              name: true,
              maxScore: true,
              order: true,
              sectionCode: true,
              sectionName: true,
              subCriteria: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  code: true,
                  content: true,
                  order: true,
                  options: {
                    orderBy: { order: 'asc' },
                    select: {
                      id: true,
                      label: true,
                      points: true,
                      order: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return categories;
}

async function createEvaluation(prisma: PrismaService, categoryId: string) {
  const suffix = randomUUID();
  const [registrant, judge] = await Promise.all([
    prisma.user.create({
      data: {
        email: `seed-registrant-${suffix}@example.invalid`,
        password: 'unused',
        fullName: 'Seed test registrant',
        role: Role.REGISTRANT,
      },
    }),
    prisma.user.create({
      data: {
        email: `seed-judge-${suffix}@example.invalid`,
        password: 'unused',
        fullName: 'Seed test judge',
        role: Role.JUDGE,
      },
    }),
  ]);
  const product = await prisma.product.create({
    data: {
      registrantId: registrant.id,
      categoryId,
      name: 'Seed history test',
      formData: {},
      status: ProductStatus.SUBMITTED,
    },
  });
  const criteriaSet = await prisma.criteriaSet.findUniqueOrThrow({
    where: { categoryId },
    select: {
      criteria: {
        orderBy: { order: 'asc' },
        select: {
          subCriteria: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              options: {
                orderBy: { order: 'asc' },
                select: { id: true, points: true },
              },
            },
          },
        },
      },
    },
  });
  const subCriterion = criteriaSet.criteria[0].subCriteria[0];
  const option = subCriterion.options[0];
  const evaluation = await prisma.evaluation.create({
    data: {
      judgeId: judge.id,
      productId: product.id,
      status: EvaluationStatus.IN_PROGRESS,
      total: option.points,
    },
  });
  await prisma.score.create({
    data: {
      evaluationId: evaluation.id,
      subCriterionId: subCriterion.id,
      optionId: option.id,
    },
  });
  return { id: evaluation.id, total: option.points };
}

async function expectEvaluationUnchanged(
  prisma: PrismaService,
  evaluationId: string,
  total: number,
) {
  await expect(
    prisma.evaluation.findUniqueOrThrow({
      where: { id: evaluationId },
      include: {
        scores: { include: { option: { select: { points: true } } } },
      },
    }),
  ).resolves.toMatchObject({
    total,
    scores: [{ option: { points: total } }],
  });
}

describe('seed scoring history guard', () => {
  it('preserves IDs while synchronizing and remains idempotent', async () => {
    await withTestApp(async ({ prisma }) => {
      const before = await scoringSnapshot(
        prisma,
        officialCategories.map(({ id }) => id),
      );
      const ids = (rows: typeof before) =>
        rows.map(({ id, criteriaSet }) => ({
          id,
          criteriaSet: criteriaSet?.id,
          criteria: criteriaSet?.criteria.map(
            ({ id: criterionId, subCriteria }) => ({
              id: criterionId,
              subCriteria: subCriteria.map(
                ({ id: subCriterionId, options }) => ({
                  id: subCriterionId,
                  options: options.map(({ id: optionId }) => optionId),
                }),
              ),
            }),
          ),
        }));
      const sandbox = seedSandbox();
      try {
        expect(runSeed(sandbox.root).status).toBe(0);
        const synchronized = await scoringSnapshot(
          prisma,
          officialCategories.map(({ id }) => id),
        );
        expect(ids(synchronized)).toEqual(ids(before));
        expect(runSeed(sandbox.root).status).toBe(0);
        await expect(
          scoringSnapshot(
            prisma,
            officialCategories.map(({ id }) => id),
          ),
        ).resolves.toEqual(synchronized);
      } finally {
        rmSync(sandbox.root, { recursive: true, force: true });
      }
    });
  });

  it('preflights late used bundles before any earlier bundle upsert', async () => {
    await withTestApp(async ({ prisma }) => {
      const first = officialCategories[0];
      const lastSet = officialSets().at(-1);
      const last = officialCategories.find(
        ({ criteriaSetKey }) => criteriaSetKey === lastSet.categoryKey,
      );
      const evaluation = await createEvaluation(prisma, last.id);
      const before = await scoringSnapshot(prisma, [first.id, last.id]);
      const sandbox = seedSandbox((sets) => {
        const early = sets[0];
        early.name = `${early.name} edited`;
        const used = sets.find(
          ({ categoryKey }) => categoryKey === last.criteriaSetKey,
        );
        used.criteria[0].subCriteria[0].options[0].points += 1;
      });
      try {
        const result = runSeed(sandbox.root);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(
          `Cannot alter used scoring criteria for category ${last.id}`,
        );
      } finally {
        rmSync(sandbox.root, { recursive: true, force: true });
      }
      await expect(
        scoringSnapshot(prisma, [first.id, last.id]),
      ).resolves.toEqual(before);
      await expectEvaluationUnchanged(prisma, evaluation.id, evaluation.total);
    });
  });

  it.each(['points', 'option order', 'removed option'] as const)(
    'rejects a used bundle %s mutation',
    async (mutation) => {
      await withTestApp(async ({ prisma }) => {
        const category = officialCategories[0];
        const evaluation = await createEvaluation(prisma, category.id);
        const before = await scoringSnapshot(prisma, [category.id]);
        const sandbox = seedSandbox((sets) => {
          const set = sets.find(
            ({ categoryKey }) => categoryKey === category.criteriaSetKey,
          );
          const options = set.criteria[0].subCriteria[0].options;
          if (mutation === 'points') options[0].points += 1;
          else if (mutation === 'option order') options.reverse();
          else options.splice(0, 1);
        });
        try {
          const result = runSeed(sandbox.root);
          expect(result.status).not.toBe(0);
          expect(result.stderr).toContain(
            `Cannot alter used scoring criteria for category ${category.id}`,
          );
        } finally {
          rmSync(sandbox.root, { recursive: true, force: true });
        }
        await expect(scoringSnapshot(prisma, [category.id])).resolves.toEqual(
          before,
        );
        await expectEvaluationUnchanged(
          prisma,
          evaluation.id,
          evaluation.total,
        );
      });
    },
  );
});

it('seeds exactly 26 independent official categories in order without fabricated catalogs', async () => {
  await withTestApp(async ({ prisma }) => {
    const initialSeed = seedSandbox();
    try {
      expect(runSeed(initialSeed.root).status).toBe(0);
    } finally {
      rmSync(initialSeed.root, { recursive: true, force: true });
    }
    const categories = await prisma.productCategory.findMany({
      include: { criteriaSet: true },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    expect(categories).toHaveLength(26);
    const catalog = JSON.parse(
      readFileSync(join(officialDataDir, 'categories.json'), 'utf8'),
    ).categories;
    expect(categories.map(({ id }) => id)).toEqual(
      catalog.map((c: { id: string }) => c.id),
    );
    for (const [index, category] of catalog.entries()) {
      expect(categories[index]).toMatchObject({
        id: category.id,
        name: category.name,
        order: index + 1,
        criteriaSet: {
          isActive: true,
          version: expect.any(String),
          sourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });
      expect(categories[index]).not.toHaveProperty('groupId');
    }
    expect(await prisma.organizationUnit.count()).toBe(0);
    expect(await prisma.locality.count()).toBe(0);
    const before = await scoringSnapshot(
      prisma,
      categories.map(({ id }) => id),
    );
    const sandbox = seedSandbox();
    try {
      expect(runSeed(sandbox.root).status).toBe(0);
    } finally {
      rmSync(sandbox.root, { recursive: true, force: true });
    }
    expect(
      await scoringSnapshot(
        prisma,
        categories.map(({ id }) => id),
      ),
    ).toEqual(before);
  });
});

it('preserves admin-managed catalog metadata and extra categories when reseeding', async () => {
  await withTestApp(async ({ prisma }) => {
    const official = officialCategories[0];
    await prisma.productCategory.update({
      where: { id: official.id },
      data: {
        name: 'Admin renamed category',
        description: 'Admin category description',
        order: 66,
        isActive: false,
      },
    });
    const extraCategory = await prisma.productCategory.create({
      data: {
        id: 'test-extra-' + randomUUID(),
        name: 'Extra category ' + randomUUID(),
        order: 90,
        isActive: false,
      },
    });
    const sandbox = seedSandbox();
    try {
      expect(runSeed(sandbox.root).status).toBe(0);
    } finally {
      rmSync(sandbox.root, { recursive: true, force: true });
    }
    await expect(
      prisma.productCategory.findUniqueOrThrow({ where: { id: official.id } }),
    ).resolves.toMatchObject({
      name: 'Admin renamed category',
      description: 'Admin category description',
      order: 66,
      isActive: false,
    });
    await expect(
      prisma.productCategory.findUniqueOrThrow({
        where: { id: extraCategory.id },
      }),
    ).resolves.toMatchObject({
      name: extraCategory.name,
    });
  });
});

it('seeds sample OCOP products across multiple categories and all 4 statuses idempotently when test accounts are enabled', async () => {
  await withTestApp(async ({ prisma }) => {
    const sandbox = seedSandbox();
    const runWithSampleData = () =>
      spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(require.resolve('tsx')).href,
          resolve(__dirname, '../prisma/seed/seed.ts'),
          '--seed-test-accounts',
          '--only-sample-data',
        ],
        {
          cwd: sandbox.root,
          env: {
            ...process.env,
            DOTENV_CONFIG_PATH: join(sandbox.root, '.env'),
          },
          encoding: 'utf8',
          timeout: 300000,
        },
      );

    try {
      const firstRun = runWithSampleData();
      expect(firstRun.status).toBe(0);

      const products = await prisma.product.findMany({
        include: {
          category: { select: { id: true } },
          statusEvents: { orderBy: { sequence: 'asc' } },
          evaluations: { include: { scores: true } },
        },
      });
      expect(products.length).toBeGreaterThanOrEqual(8);

      expect(
        new Set(products.map((p) => p.category.id)).size,
      ).toBeGreaterThanOrEqual(6);

      const statuses = new Set(products.map((p) => p.status));
      expect(statuses).toEqual(
        new Set([
          ProductStatus.DRAFT,
          ProductStatus.SUBMITTED,
          ProductStatus.SCORING,
          ProductStatus.COMPLETED,
        ]),
      );

      for (const product of products) {
        expect(product.statusEvents.length).toBeGreaterThanOrEqual(1);
        if (product.status !== ProductStatus.DRAFT) {
          expect(product.submittedAt).toBeInstanceOf(Date);
          expect(product.localityId).toBeTruthy();
          expect(product.registrationSnapshot).toBeTruthy();
        }
        if (product.status === ProductStatus.SCORING) {
          expect(product.evaluations.length).toBeGreaterThanOrEqual(1);
        }
        if (product.status === ProductStatus.COMPLETED) {
          expect(product.completedAt).toBeInstanceOf(Date);
          expect(product.finalScore).toBeGreaterThan(0);
          expect(product.starRating).toBeGreaterThanOrEqual(1);
          expect(product.evaluations.length).toBeGreaterThanOrEqual(2);
          for (const evaluation of product.evaluations) {
            expect(evaluation.status).toBe(EvaluationStatus.SUBMITTED);
            expect(evaluation.submissionSnapshot).toBeTruthy();
            expect(evaluation.scores.length).toBeGreaterThan(0);
          }
        }
      }

      const secondRun = runWithSampleData();
      expect(secondRun.status).toBe(0);
      expect(await prisma.product.count()).toBe(products.length);
    } finally {
      rmSync(sandbox.root, { recursive: true, force: true });
    }
  });
});
