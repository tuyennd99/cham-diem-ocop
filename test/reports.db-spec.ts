import {
  Prisma,
  PrismaClient,
  ReportKind,
  ReportStatus,
  TaskType,
} from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { FilesRepository } from '../src/repositories/files.repository';
import { ReportsRepository } from '../src/repositories/reports.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const testUrl = process.env.TEST_DATABASE_URL;
if (
  !testUrl ||
  !/^postgresql:\/\/[^/]+@(?:127\.0\.0\.1|localhost):5433\/congan_task_test(?:\?|$)/.test(
    testUrl,
  )
) {
  throw new Error(
    'TEST_DATABASE_URL must target congan_task_test on localhost:5433',
  );
}
process.env.DATABASE_URL = testUrl;

describe('PostgreSQL report invariants', () => {
  let prisma: PrismaService;
  let reports: ReportsRepository;
  let files: FilesRepository;
  let suffix: string;
  let actorId: number;
  let assigningOrganizationId: number;
  let leadOrganizationId: number;
  let collaboratorOrganizationIds: number[];
  let collaboratorUserIds: number[];
  let programId: number;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    reports = new ReportsRepository(prisma);
    files = new FilesRepository(prisma);
    suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

    const [assigning, lead, collaboratorOne, collaboratorTwo] =
      await Promise.all(
        [
          ['assigning', true],
          ['lead', false],
          ['collaborator-1', false],
          ['collaborator-2', false],
        ].map(([label, assigningAuthority]) =>
          prisma.organization.create({
            data: {
              code: `${label}-${suffix}`,
              name: `${label} ${suffix}`,
              isAssigningAuthority: Boolean(assigningAuthority),
              isExecutingUnit: true,
            },
          }),
        ),
      );
    assigningOrganizationId = assigning.id;
    leadOrganizationId = lead.id;
    collaboratorOrganizationIds = [collaboratorOne.id, collaboratorTwo.id];
    const actor = await prisma.user.create({
      data: {
        username: `actor-${suffix}`,
        fullName: 'Database test actor',
        passwordHash: 'not-used-in-database-tests',
        organizationId: assigning.id,
      },
    });
    actorId = actor.id;
    const program = await prisma.program.create({
      data: {
        code: `program-${suffix}`,
        name: `Program ${suffix}`,
        assigningOrganizationId,
        leadOrganizationId,
        collaborators: {
          create: collaboratorOrganizationIds.map((organizationId) => ({
            organizationId,
          })),
        },
      },
    });
    programId = program.id;
    collaboratorUserIds = await Promise.all(
      collaboratorOrganizationIds.map(async (organizationId, index) => {
        const user = await prisma.user.create({
          data: {
            username: `collaborator-${index}-${suffix}`,
            fullName: `Collaborator ${index + 1}`,
            passwordHash: 'not-used-in-database-tests',
            organizationId,
          },
        });
        return user.id;
      }),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('does not complete an ad-hoc task when collaborator reports are approved', async () => {
    const task = await createTask(prisma, {
      code: `concurrent-${suffix}`,
      actorId,
      programId,
      assigningOrganizationId,
      leadOrganizationId,
      collaboratorOrganizationIds,
    });
    const workspaces = await Promise.all(
      collaboratorOrganizationIds.map((organizationId, index) =>
        prisma.reportWorkspace.create({
          data: {
            kind: ReportKind.PROGRESS,
            taskId: task.id,
            ownerOrganizationId: organizationId,
            ownerUserId: collaboratorUserIds[index],
            status: ReportStatus.SUBMITTED,
            content: `Report ${index + 1}`,
            versions: {
              create: {
                versionNumber: 1,
                content: `Report ${index + 1}`,
                submittedById: actorId,
              },
            },
          },
        }),
      ),
    );

    const reviewed = await Promise.all(
      workspaces.map((workspace) =>
        reports.approveLatest(workspace.id, actorId, {
          organizationId: assigningOrganizationId,
          requestId: `approve-${workspace.id}`,
        }),
      ),
    );

    expect(reviewed.every((version) => version?.status === 'APPROVED')).toBe(
      true,
    );
    const [completedTask, approvedCount] = await Promise.all([
      prisma.task.findUniqueOrThrow({ where: { id: task.id } }),
      prisma.reportWorkspace.count({
        where: {
          taskId: task.id,
          status: ReportStatus.APPROVED,
        },
      }),
    ]);
    expect(approvedCount).toBe(2);
    expect(completedTask.completedAt).toBeNull();
  });

  it('keeps submitted versions immutable and rejects a late draft upload', async () => {
    const task = await createTask(prisma, {
      code: `immutable-${suffix}`,
      actorId,
      programId,
      assigningOrganizationId,
      leadOrganizationId,
      collaboratorOrganizationIds: [collaboratorOrganizationIds[0]],
    });
    const workspace = await prisma.reportWorkspace.create({
      data: {
        kind: ReportKind.PROGRESS,
        taskId: task.id,
        ownerOrganizationId: collaboratorOrganizationIds[0],
        ownerUserId: collaboratorUserIds[0],
        content: 'Version one',
      },
    });

    const first = await reports.createVersionFromDraft(workspace.id, actorId, {
      organizationId: collaboratorOrganizationIds[0],
      requestId: `submit-1-${workspace.id}`,
    });
    await reports.rejectLatest(workspace.id, actorId, 'Needs revision', {
      organizationId: leadOrganizationId,
      requestId: `reject-${workspace.id}`,
    });
    await reports.saveDraft(workspace.id, 'Version two', actorId, {
      organizationId: collaboratorOrganizationIds[0],
      requestId: `draft-2-${workspace.id}`,
    });
    const second = await reports.createVersionFromDraft(workspace.id, actorId, {
      organizationId: collaboratorOrganizationIds[0],
      requestId: `submit-2-${workspace.id}`,
    });

    const persistedFirst = await prisma.reportVersion.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(persistedFirst.content).toBe('Version one');
    expect(second).toMatchObject({
      versionNumber: 2,
      content: 'Version two',
      status: ReportStatus.SUBMITTED,
    });

    await expect(
      files.addDraftFile(
        workspace.id,
        {
          originalName: 'late.pdf',
          storageKey: `late-${suffix}`,
          mimeType: 'application/pdf',
          sizeBytes: 5,
          checksum: 'checksum',
        },
        actorId,
        200 * 1024 * 1024,
        { organizationId: collaboratorOrganizationIds[0] },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      await prisma.storedFile.count({
        where: { storageKey: `late-${suffix}` },
      }),
    ).toBe(0);
  });

  it('enforces the unique task code in PostgreSQL', async () => {
    const code = `unique-${suffix}`;
    const input = taskData({
      code,
      actorId,
      programId,
      assigningOrganizationId,
      leadOrganizationId,
      collaboratorOrganizationIds,
    });
    await prisma.task.create({ data: input });

    await expect(prisma.task.create({ data: input })).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});

interface TaskFixture {
  code: string;
  actorId: number;
  programId: number;
  assigningOrganizationId: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
}

function taskData(input: TaskFixture): Prisma.TaskCreateInput {
  return {
    code: input.code,
    name: input.code,
    type: TaskType.DOT_XUAT,
    dueAt: new Date(Date.now() + 86_400_000),
    program: { connect: { id: input.programId } },
    assigningOrganization: { connect: { id: input.assigningOrganizationId } },
    leadOrganization: { connect: { id: input.leadOrganizationId } },
    createdBy: { connect: { id: input.actorId } },
    updatedBy: { connect: { id: input.actorId } },
  };
}

function createTask(prisma: PrismaClient, input: TaskFixture) {
  return prisma.task.create({
    data: taskData(input),
  });
}
