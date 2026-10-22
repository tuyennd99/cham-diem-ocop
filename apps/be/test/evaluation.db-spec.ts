import { EvaluationStatus, ProductStatus, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { EvaluationsRepository } from '../src/repositories/evaluations.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { withTestApp } from './support/db-app';

const pointsByCriterion = { A: [0, 30, 40, 50, 60], B: [0, 30, 40] };

async function withFixture(
  prisma: PrismaService,
  run: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>,
) {
  const fixture = await createFixture(prisma);
  try {
    await run(fixture);
  } finally {
    await prisma.product.deleteMany({
      where: { registrantId: fixture.registrantId },
    });
    await prisma.criteriaSet.deleteMany({ where: { categoryId: fixture.categoryId } });
    await prisma.productCategory.delete({ where: { id: fixture.categoryId } });
    await prisma.user.deleteMany({
      where: { id: { in: [fixture.registrantId, ...fixture.judgeIds] } },
    });
  }
}

async function createFixture(prisma: PrismaService) {
  const suffix = randomUUID();
  const registrant = await prisma.user.create({
    data: {
      email: `evaluation-registrant-${suffix}@example.invalid`,
      password: 'unused',
      fullName: 'Test Registrant',
      role: Role.REGISTRANT,
    },
  });
  const judges = await Promise.all(
    [1, 2].map((n) =>
      prisma.user.create({
        data: {
          email: `evaluation-judge-${n}-${suffix}@example.invalid`,
          password: 'unused',
          fullName: `Test Judge ${n}`,
          role: Role.JUDGE,
          verified: true,
          isActive: true,
        },
      }),
    ),
  );
  const category = await prisma.productCategory.create({
    data: {
      groupCode: `test-${suffix}`,
      groupName: 'Test group',
      classificationGroup: 'Test classification',
      name: `Evaluation test ${suffix}`,
      criteriaSet: {
        create: {
          name: 'Test criteria',
          criteria: {
            create: [
              {
                code: 'A',
                name: 'Criterion A',
                maxScore: 60,
                sectionCode: 'A',
                sectionName: 'A',
                order: 1,
                subCriteria: {
                  create: {
                    code: 'A1',
                    content: 'Subcriterion A',
                    order: 1,
                    options: {
                      create: pointsByCriterion.A.map((point, order) => ({
                        label: `${point}`,
                        points: point,
                        order,
                      })),
                    },
                  },
                },
              },
              {
                code: 'B',
                name: 'Criterion B',
                maxScore: 40,
                sectionCode: 'B',
                sectionName: 'B',
                order: 2,
                subCriteria: {
                  create: {
                    code: 'B1',
                    content: 'Subcriterion B',
                    order: 1,
                    options: {
                      create: pointsByCriterion.B.map((point, order) => ({
                        label: `${point}`,
                        points: point,
                        order,
                      })),
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
    include: {
      criteriaSet: {
        include: {
          criteria: {
            include: { subCriteria: { include: { options: true } } },
          },
        },
      },
    },
  });
  await prisma.judgeAssignment.createMany({
    data: judges.map(({ id }) => ({ judgeId: id, categoryId: category.id })),
  });
  const product = await createProduct(prisma, registrant.id, category.id);
  return {
    categoryId: category.id,
    criteria: category.criteriaSet!.criteria,
    judgeIds: judges.map(({ id }) => id),
    productId: product.id,
    registrantId: registrant.id,
  };
}

async function createProduct(
  prisma: PrismaService,
  registrantId: string,
  categoryId: string,
) {
  return prisma.product.create({
    data: {
      registrantId,
      categoryId,
      name: 'Scoring fixture',
      formData: {},
      status: ProductStatus.SUBMITTED,
    },
  });
}

function scores(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  a: number,
  b?: number,
) {
  return fixture.criteria.flatMap((criterion) => {
    if (criterion.code === 'B' && b === undefined) return [];
    const pointsValue = criterion.code === 'A' ? a : b!;
    const sub = criterion.subCriteria[0];
    const option = sub.options.find(
      ({ points: optionPoints }) => optionPoints === pointsValue,
    )!;
    return [{ subCriterionId: sub.id, optionId: option.id }];
  });
}

async function waitForBlockedQuery(
  client: Client,
  schema: string,
  table: string,
) {
  const tableName = table === 'products' ? 'products' : 'product_categories';
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await client.query(
      `SELECT 1 FROM pg_stat_activity a
       WHERE a.wait_event_type = 'Lock'
         AND EXISTS (
           SELECT 1 FROM pg_locks l
           JOIN pg_class c ON c.oid = l.relation
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE l.pid = a.pid AND n.nspname = $1 AND c.relname = $2
         )
       LIMIT 1`,
      [schema, tableName],
    );
    if (result.rowCount) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `Timed out waiting for a transaction blocked on ${tableName}`,
  );
}

describe('evaluation persistence', () => {
  it('keeps a submitted evaluation immutable', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const repository = app.get(EvaluationsRepository);
        await repository.saveDraft(
          fixture.judgeIds[0],
          fixture.productId,
          scores(fixture, 50, 30),
        );
        await repository.submit(fixture.judgeIds[0], fixture.productId);
        await expect(
          repository.saveDraft(
            fixture.judgeIds[0],
            fixture.productId,
            scores(fixture, 40, 30),
          ),
        ).rejects.toThrow('Submitted evaluations are immutable');
        await expect(
          prisma.evaluation.findUniqueOrThrow({
            where: {
              judgeId_productId: {
                judgeId: fixture.judgeIds[0],
                productId: fixture.productId,
              },
            },
          }),
        ).resolves.toMatchObject({ status: EvaluationStatus.SUBMITTED });
      }),
    );
  });

  it('uses the existing full-scope and partial-scope scoring rules', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const repository = app.get(EvaluationsRepository);
        for (const [index, result] of [
          [0, [60, 30]],
          [1, [40, 30]],
        ] as const) {
          await repository.saveDraft(
            fixture.judgeIds[index],
            fixture.productId,
            scores(fixture, result[0], result[1]),
          );
          await repository.submit(fixture.judgeIds[index], fixture.productId);
        }
        await expect(
          prisma.product.findUniqueOrThrow({
            where: { id: fixture.productId },
          }),
        ).resolves.toMatchObject({
          status: ProductStatus.COMPLETED,
          finalScore: 80,
          starRating: 4,
        });

        await prisma.judgeAssignment.update({
          where: {
            judgeId_categoryId: {
              judgeId: fixture.judgeIds[1],
              categoryId: fixture.categoryId,
            },
          },
          data: { criterionIds: [fixture.criteria[0].id] },
        });
        const product = await createProduct(
          prisma,
          fixture.registrantId,
          fixture.categoryId,
        );
        await repository.saveDraft(
          fixture.judgeIds[0],
          product.id,
          scores(fixture, 50, 30),
        );
        await repository.submit(fixture.judgeIds[0], product.id);
        await repository.saveDraft(
          fixture.judgeIds[1],
          product.id,
          scores(fixture, 40),
        );
        await repository.submit(fixture.judgeIds[1], product.id);
        await expect(
          prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
        ).resolves.toMatchObject({
          status: ProductStatus.COMPLETED,
          finalScore: 75,
          starRating: 4,
        });
      }),
    );
  });

  it('rejects submission when any assigned subcriterion is missing', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const repository = app.get(EvaluationsRepository);
        await repository.saveDraft(
          fixture.judgeIds[0],
          fixture.productId,
          scores(fixture, 50),
        );
        await expect(
          repository.submit(fixture.judgeIds[0], fixture.productId),
        ).rejects.toThrow(
          'Score every assigned subcriterion before submitting',
        );
        await expect(
          prisma.product.findUniqueOrThrow({
            where: { id: fixture.productId },
          }),
        ).resolves.toMatchObject({
          status: ProductStatus.SCORING,
          finalScore: null,
          starRating: null,
        });
      }),
    );
  });

  it('aggregates both judges when assigned judges submit concurrently', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const repository = app.get(EvaluationsRepository);
        await repository.saveDraft(
          fixture.judgeIds[0],
          fixture.productId,
          scores(fixture, 60, 30),
        );
        await repository.saveDraft(
          fixture.judgeIds[1],
          fixture.productId,
          scores(fixture, 40, 30),
        );
        const dbUrl = new URL(process.env.DATABASE_URL!);
        const schema = dbUrl.searchParams.get('schema') ?? 'public';
        dbUrl.searchParams.delete('schema');
        const locker = new Client({ connectionString: dbUrl.toString() });
        let connected = false;
        let transactionOpen = false;
        const submissions: Promise<unknown>[] = [];
        try {
          await locker.connect();
          connected = true;
          await locker.query('BEGIN');
          transactionOpen = true;
          await locker.query(
            `SELECT "id" FROM "${schema}"."products" WHERE "id" = $1 FOR UPDATE`,
            [fixture.productId],
          );
          submissions.push(
            repository.submit(fixture.judgeIds[0], fixture.productId),
          );
          await waitForBlockedQuery(locker, schema, 'products');
          submissions.push(
            repository.submit(fixture.judgeIds[1], fixture.productId),
          );
          await waitForBlockedQuery(locker, schema, 'product_categories');
          await locker.query('COMMIT');
          transactionOpen = false;
          const outcomes = await Promise.allSettled(submissions);
          expect(outcomes.every(({ status }) => status === 'fulfilled')).toBe(
            true,
          );
          await expect(
            prisma.evaluation.findMany({
              where: { productId: fixture.productId },
              select: { status: true, total: true },
            }),
          ).resolves.toEqual(
            expect.arrayContaining([
              { status: EvaluationStatus.SUBMITTED, total: 90 },
              { status: EvaluationStatus.SUBMITTED, total: 70 },
            ]),
          );
          await expect(
            prisma.product.findUniqueOrThrow({
              where: { id: fixture.productId },
            }),
          ).resolves.toMatchObject({
            status: ProductStatus.COMPLETED,
            finalScore: 80,
            starRating: 4,
          });
        } finally {
          if (transactionOpen) {
            await locker.query('ROLLBACK').catch(() => undefined);
          }
          if (connected) await locker.end().catch(() => undefined);
          await Promise.allSettled(submissions);
        }
      }),
    );
  });

  it.each(['submit', 'save'] as const)(
    'serializes concurrent %s-first writes without reopening a submitted evaluation',
    async (firstOperation) => {
      await withTestApp(async ({ app, prisma }) =>
        withFixture(prisma, async (fixture) => {
          const repository = app.get(EvaluationsRepository);
          await repository.saveDraft(
            fixture.judgeIds[0],
            fixture.productId,
            scores(fixture, 50, 30),
          );
          const dbUrl = new URL(process.env.DATABASE_URL!);
          const schema = dbUrl.searchParams.get('schema') ?? 'public';
          dbUrl.searchParams.delete('schema');
          const locker = new Client({
            connectionString: dbUrl.toString(),
          });
          await locker.connect();
          await locker.query('BEGIN');
          try {
            await locker.query(
              `SELECT "id" FROM "${schema}"."products" WHERE "id" = $1 FOR UPDATE`,
              [fixture.productId],
            );
            const submit = () =>
              repository.submit(fixture.judgeIds[0], fixture.productId);
            const save = () =>
              repository.saveDraft(
                fixture.judgeIds[0],
                fixture.productId,
                scores(fixture, 40, 30),
              );
            const first = firstOperation === 'submit' ? submit() : save();
            await waitForBlockedQuery(locker, schema, 'products');
            const second = firstOperation === 'submit' ? save() : submit();
            await waitForBlockedQuery(locker, schema, 'product_categories');
            await locker.query('COMMIT');
            const outcomes = await Promise.allSettled([first, second]);
            if (firstOperation === 'submit') {
              expect(outcomes[0].status).toBe('fulfilled');
              expect(outcomes[1]).toMatchObject({
                status: 'rejected',
                reason: expect.objectContaining({
                  message: 'Submitted evaluations are immutable',
                }),
              });
            } else {
              expect(
                outcomes.every(({ status }) => status === 'fulfilled'),
              ).toBe(true);
              await expect(
                prisma.evaluation.findUniqueOrThrow({
                  where: {
                    judgeId_productId: {
                      judgeId: fixture.judgeIds[0],
                      productId: fixture.productId,
                    },
                  },
                }),
              ).resolves.toMatchObject({
                status: EvaluationStatus.SUBMITTED,
                total: 70,
              });
            }
            const product = await prisma.product.findUniqueOrThrow({
              where: { id: fixture.productId },
            });
            expect(product.status).not.toBe(ProductStatus.COMPLETED);
          } finally {
            await locker.query('ROLLBACK').catch(() => undefined);
            await locker.end();
          }
        }),
      );
    },
  );
});
