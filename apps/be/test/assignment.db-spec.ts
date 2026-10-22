import { ConflictException } from '@nestjs/common';
import { EvaluationStatus, ProductStatus, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { AdminRepository } from '../src/repositories/admin.repository';
import { EvaluationsRepository } from '../src/repositories/evaluations.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import { withTestApp } from './support/db-app';

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
      where: {
        id: {
          in: [fixture.adminId, fixture.registrantId, ...fixture.judgeIds],
        },
      },
    });
  }
}

async function createFixture(prisma: PrismaService) {
  const suffix = randomUUID();
  const [admin, registrant, ...judges] = await Promise.all([
    prisma.user.create({
      data: {
        email: `assignment-admin-${suffix}@example.invalid`,
        password: 'unused',
        fullName: 'Test Admin',
        role: Role.ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        email: `assignment-registrant-${suffix}@example.invalid`,
        password: 'unused',
        fullName: 'Test Registrant',
        role: Role.REGISTRANT,
      },
    }),
    ...[1, 2].map((n) =>
      prisma.user.create({
        data: {
          email: `assignment-judge-${n}-${suffix}@example.invalid`,
          password: 'unused',
          fullName: `Test Judge ${n}`,
          role: Role.JUDGE,
          verified: true,
        },
      }),
    ),
  ]);
  const category = await prisma.productCategory.create({
    data: {
      group: { connect: { code: 'FOOD' } },
      groupCode: `assignment-${suffix}`,
      groupName: 'Test group',
      classificationGroup: 'Test classification',
      name: `Assignment test ${suffix}`,
      criteriaSet: {
        create: {
          name: 'Test criteria',
          criteria: {
            create: [
              {
                code: 'A',
                name: 'Criterion A',
                maxScore: 50,
                sectionCode: 'A',
                sectionName: 'A',
                order: 1,
                subCriteria: {
                  create: {
                    code: 'A1',
                    content: 'Subcriterion A',
                    order: 1,
                    options: {
                      create: [0, 50].map((points, order) => ({
                        label: `${points}`,
                        points,
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
                      create: [0, 40].map((points, order) => ({
                        label: `${points}`,
                        points,
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
  const product = await prisma.product.create({
    data: {
      registrantId: registrant.id,
      categoryId: category.id,
      name: 'Assignment fixture',
      formData: {},
      status: ProductStatus.SUBMITTED,
    },
  });
  return {
    adminId: admin.id,
    categoryId: category.id,
    criteria: category.criteriaSet!.criteria,
    judgeIds: judges.map(({ id }) => id),
    productId: product.id,
    registrantId: registrant.id,
  };
}

function scorePayload(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  a: number,
  b?: number,
) {
  return fixture.criteria.flatMap((criterion) => {
    if (criterion.code === 'B' && b === undefined) return [];
    const sub = criterion.subCriteria[0];
    return [
      {
        subCriterionId: sub.id,
        optionId: sub.options.find(
          ({ points }) => points === (criterion.code === 'A' ? a : b),
        )!.id,
      },
    ];
  });
}

async function waitForLockWaiters(
  client: Client,
  schema: string,
  count: number,
) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count FROM pg_stat_activity a
       WHERE a.wait_event_type = 'Lock'
         AND EXISTS (
           SELECT 1 FROM pg_locks l
           JOIN pg_class c ON c.oid = l.relation
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE l.pid = a.pid AND n.nspname = $1 AND c.relname = 'product_categories'
         )`,
      [schema],
    );
    if (result.rows[0].count >= count) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `Timed out waiting for ${count} assignment/scoring category lock waiters`,
  );
}

describe('assignment persistence', () => {
  it('rejects changing a submitted judge scope on open work and leaves assignments intact', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const admin = new AdminRepository(app.get(PrismaService));
        const evaluations = new EvaluationsRepository(app.get(PrismaService));
        const [criterionA, criterionB] = fixture.criteria;
        await prisma.judgeAssignment.createMany({
          data: [
            {
              judgeId: fixture.judgeIds[0],
              categoryId: fixture.categoryId,
              criterionIds: [criterionA.id],
            },
            {
              judgeId: fixture.judgeIds[1],
              categoryId: fixture.categoryId,
              criterionIds: [criterionB.id],
            },
          ],
        });
        await evaluations.saveDraft(
          fixture.judgeIds[0],
          fixture.productId,
          scorePayload(fixture, 50),
        );
        await evaluations.submit(fixture.judgeIds[0], fixture.productId);

        await expect(
          admin.replaceAssignments(
            [
              {
                judgeId: fixture.judgeIds[0],
                categoryId: fixture.categoryId,
                criterionIds: [],
              },
              {
                judgeId: fixture.judgeIds[1],
                categoryId: fixture.categoryId,
                criterionIds: [criterionB.id],
              },
            ],
            fixture.adminId,
            undefined,
            {},
          ),
        ).rejects.toThrow(
          new ConflictException(
            'Cannot change criteria for a submitted evaluation',
          ),
        );
        await expect(
          prisma.judgeAssignment.findUniqueOrThrow({
            where: {
              judgeId_categoryId: {
                judgeId: fixture.judgeIds[0],
                categoryId: fixture.categoryId,
              },
            },
          }),
        ).resolves.toMatchObject({ criterionIds: [criterionA.id] });
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
          total: 50,
        });
      }),
    );
  });

  it('recomputes open results after removing a pending judge and never changes completed results', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const admin = new AdminRepository(app.get(PrismaService));
        const evaluations = new EvaluationsRepository(app.get(PrismaService));
        await prisma.judgeAssignment.createMany({
          data: fixture.judgeIds.map((judgeId) => ({
            judgeId,
            categoryId: fixture.categoryId,
          })),
        });
        await evaluations.saveDraft(
          fixture.judgeIds[0],
          fixture.productId,
          scorePayload(fixture, 50, 40),
        );
        await evaluations.submit(fixture.judgeIds[0], fixture.productId);
        await evaluations.saveDraft(
          fixture.judgeIds[1],
          fixture.productId,
          scorePayload(fixture, 0, 0),
        );

        await admin.replaceAssignments(
          [
            {
              judgeId: fixture.judgeIds[0],
              categoryId: fixture.categoryId,
              criterionIds: [],
            },
          ],
          fixture.adminId,
          undefined,
          {},
        );
        await expect(
          prisma.product.findUniqueOrThrow({
            where: { id: fixture.productId },
          }),
        ).resolves.toMatchObject({
          status: ProductStatus.COMPLETED,
          finalScore: 90,
          starRating: 5,
        });

        await admin.replaceAssignments(
          [
            {
              judgeId: fixture.judgeIds[1],
              categoryId: fixture.categoryId,
              criterionIds: [],
            },
          ],
          fixture.adminId,
          undefined,
          {},
        );
        await expect(
          prisma.product.findUniqueOrThrow({
            where: { id: fixture.productId },
          }),
        ).resolves.toMatchObject({
          status: ProductStatus.COMPLETED,
          finalScore: 90,
          starRating: 5,
        });
      }),
    );
  });

  it('keeps drafts for unchanged scopes, treats order and []/all as equivalent, and resets drafts on a real scope change', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const admin = new AdminRepository(app.get(PrismaService));
        const [criterionA, criterionB] = fixture.criteria;
        const both = [criterionA.id, criterionB.id];
        await admin.replaceAssignments(
          [
            {
              judgeId: fixture.judgeIds[0],
              categoryId: fixture.categoryId,
              criterionIds: both,
            },
          ],
          fixture.adminId,
          undefined,
          {},
        );
        const evaluations = new EvaluationsRepository(app.get(PrismaService));
        await evaluations.saveDraft(
          fixture.judgeIds[0],
          fixture.productId,
          scorePayload(fixture, 50, 40),
        );

        await admin.replaceAssignments(
          [
            {
              judgeId: fixture.judgeIds[0],
              categoryId: fixture.categoryId,
              criterionIds: [...both].reverse(),
            },
          ],
          fixture.adminId,
          undefined,
          {},
        );
        await expect(
          prisma.evaluation.findUniqueOrThrow({
            where: {
              judgeId_productId: {
                judgeId: fixture.judgeIds[0],
                productId: fixture.productId,
              },
            },
            include: { scores: true },
          }),
        ).resolves.toMatchObject({
          status: EvaluationStatus.IN_PROGRESS,
          total: null,
          scores: expect.arrayContaining([
            expect.objectContaining({
              subCriterionId: criterionA.subCriteria[0].id,
            }),
            expect.objectContaining({
              subCriterionId: criterionB.subCriteria[0].id,
            }),
          ]),
        });

        await admin.replaceAssignments(
          [
            {
              judgeId: fixture.judgeIds[0],
              categoryId: fixture.categoryId,
              criterionIds: [],
            },
          ],
          fixture.adminId,
          undefined,
          {},
        );
        await expect(
          prisma.evaluation.findUniqueOrThrow({
            where: {
              judgeId_productId: {
                judgeId: fixture.judgeIds[0],
                productId: fixture.productId,
              },
            },
            include: { scores: true },
          }),
        ).resolves.toMatchObject({
          scores: expect.arrayContaining([
            expect.objectContaining({
              subCriterionId: criterionA.subCriteria[0].id,
            }),
            expect.objectContaining({
              subCriterionId: criterionB.subCriteria[0].id,
            }),
          ]),
        });

        await admin.replaceAssignments(
          [
            {
              judgeId: fixture.judgeIds[0],
              categoryId: fixture.categoryId,
              criterionIds: [criterionA.id],
            },
            {
              judgeId: fixture.judgeIds[1],
              categoryId: fixture.categoryId,
              criterionIds: [criterionB.id],
            },
          ],
          fixture.adminId,
          undefined,
          {},
        );
        await expect(
          prisma.evaluation.findUniqueOrThrow({
            where: {
              judgeId_productId: {
                judgeId: fixture.judgeIds[0],
                productId: fixture.productId,
              },
            },
            include: { scores: true },
          }),
        ).resolves.toMatchObject({
          status: EvaluationStatus.IN_PROGRESS,
          total: null,
          scores: [],
        });
      }),
    );
  });

  it('rolls back when replacement leaves an open category without criterion coverage', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const admin = new AdminRepository(app.get(PrismaService));
        const [criterionA] = fixture.criteria;
        await prisma.judgeAssignment.create({
          data: {
            judgeId: fixture.judgeIds[0],
            categoryId: fixture.categoryId,
            criterionIds: [],
          },
        });
        await expect(
          admin.replaceAssignments(
            [
              {
                judgeId: fixture.judgeIds[0],
                categoryId: fixture.categoryId,
                criterionIds: [criterionA.id],
              },
            ],
            fixture.adminId,
            undefined,
            {},
          ),
        ).rejects.toThrow(ConflictException);
        await expect(
          prisma.judgeAssignment.findUniqueOrThrow({
            where: {
              judgeId_categoryId: {
                judgeId: fixture.judgeIds[0],
                categoryId: fixture.categoryId,
              },
            },
          }),
        ).resolves.toMatchObject({ criterionIds: [] });
      }),
    );
  });

  it('revalidates active judge and criterion membership inside the locked transaction', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const admin = new AdminRepository(app.get(PrismaService));
        const judgeId = fixture.judgeIds[0];
        await prisma.user.update({
          where: { id: judgeId },
          data: { isActive: false },
        });
        await expect(
          admin.replaceAssignments(
            [{ judgeId, categoryId: fixture.categoryId, criterionIds: [] }],
            fixture.adminId,
            undefined,
            {},
          ),
        ).rejects.toThrow('Assignments must reference active judges');
        await prisma.user.update({
          where: { id: judgeId },
          data: { isActive: true },
        });
        await expect(
          admin.replaceAssignments(
            [
              {
                judgeId,
                categoryId: fixture.categoryId,
                criterionIds: ['criterion-from-another-category'],
              },
            ],
            fixture.adminId,
            undefined,
            {},
          ),
        ).rejects.toThrow('Assignment criterion must belong to its category');
        await expect(prisma.judgeAssignment.count()).resolves.toBe(0);
      }),
    );
  });

  it('serializes a scope replacement ahead of a concurrent submit', async () => {
    await withTestApp(async ({ app, prisma }) =>
      withFixture(prisma, async (fixture) => {
        const admin = new AdminRepository(app.get(PrismaService));
        const evaluations = new EvaluationsRepository(app.get(PrismaService));
        const [criterionA, criterionB] = fixture.criteria;
        await prisma.judgeAssignment.createMany({
          data: [
            {
              judgeId: fixture.judgeIds[0],
              categoryId: fixture.categoryId,
              criterionIds: [criterionA.id],
            },
            {
              judgeId: fixture.judgeIds[1],
              categoryId: fixture.categoryId,
              criterionIds: [criterionB.id],
            },
          ],
        });
        await evaluations.saveDraft(
          fixture.judgeIds[0],
          fixture.productId,
          scorePayload(fixture, 50),
        );

        const dbUrl = new URL(process.env.DATABASE_URL!);
        const schema = dbUrl.searchParams.get('schema') ?? 'public';
        dbUrl.searchParams.delete('schema');
        const locker = new Client({ connectionString: dbUrl.toString() });
        let transactionOpen = false;
        const operations: Promise<unknown>[] = [];
        try {
          await locker.connect();
          await locker.query('BEGIN');
          transactionOpen = true;
          await locker.query(
            `SELECT "id" FROM "${schema}"."product_categories" WHERE "id" = $1 FOR UPDATE`,
            [fixture.categoryId],
          );
          operations.push(
            admin.replaceAssignments(
              [
                {
                  judgeId: fixture.judgeIds[0],
                  categoryId: fixture.categoryId,
                  criterionIds: [],
                },
                {
                  judgeId: fixture.judgeIds[1],
                  categoryId: fixture.categoryId,
                  criterionIds: [criterionB.id],
                },
              ],
              fixture.adminId,
              undefined,
              {},
            ),
          );
          await waitForLockWaiters(locker, schema, 1);
          operations.push(
            evaluations.submit(fixture.judgeIds[0], fixture.productId),
          );
          await waitForLockWaiters(locker, schema, 2);
          await locker.query('COMMIT');
          transactionOpen = false;

          const outcomes = await Promise.allSettled(operations);
          expect(outcomes[0].status).toBe('fulfilled');
          expect(outcomes[1]).toMatchObject({
            status: 'rejected',
            reason: expect.objectContaining({
              message: 'Score every assigned subcriterion before submitting',
            }),
          });
          await expect(
            prisma.judgeAssignment.findUniqueOrThrow({
              where: {
                judgeId_categoryId: {
                  judgeId: fixture.judgeIds[0],
                  categoryId: fixture.categoryId,
                },
              },
            }),
          ).resolves.toMatchObject({ criterionIds: [] });
          await expect(
            prisma.evaluation.findUniqueOrThrow({
              where: {
                judgeId_productId: {
                  judgeId: fixture.judgeIds[0],
                  productId: fixture.productId,
                },
              },
            }),
          ).resolves.toMatchObject({ status: EvaluationStatus.IN_PROGRESS });
        } finally {
          if (transactionOpen)
            await locker.query('ROLLBACK').catch(() => undefined);
          await locker.end().catch(() => undefined);
          await Promise.allSettled(operations);
        }
      }),
    );
  });
});
