import { PrismaService } from '../prisma/prisma.service';
import { TasksRepository } from './tasks.repository';

const organization = (id: number) => ({
  id,
  code: `ORG-${id}`,
  name: `Org ${id}`,
});
const row = {
  id: 7,
  code: 'NV-007',
  name: 'Nhiệm vụ con',
  description: null,
  expectedOutput: null,
  type: 'DINH_KY',
  programId: 1,
  assigningOrganizationId: 11,
  leadOrganizationId: 21,
  assigningOrganization: organization(11),
  leadOrganization: organization(21),
  collaborators: [
    {
      id: 1,
      taskId: 7,
      organizationId: 31,
      createdAt: new Date(),
      organization: organization(31),
    },
  ],
  dueAt: null,
  deadlineStatus: null,
  startAt: null,
  closedAt: null,
  closedById: null,
  closeReason: null,
  completedAt: null,
  completedById: null,
  deletedAt: null,
  createdById: 1,
  updatedById: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  program: {
    id: 1,
    code: 'NQ57',
    name: 'Nghị quyết 57',
    description: null,
    status: 'ACTIVE',
    assigningOrganizationId: 10,
    leadOrganizationId: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
    assigningOrganization: organization(10),
    leadOrganization: organization(20),
    collaborators: [
      {
        id: 1,
        programId: 1,
        organizationId: 30,
        createdAt: new Date(),
        organization: organization(30),
      },
    ],
  },
  workspaces: [
    {
      id: 1,
      kind: 'PROGRESS',
      taskId: 7,
      ownerOrganizationId: 30,
      ownerUserId: 2,
      status: 'DRAFT',
      content: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [],
    },
    {
      id: 2,
      kind: 'PROGRESS',
      taskId: 7,
      ownerOrganizationId: 30,
      ownerUserId: 3,
      status: 'SUBMITTED',
      content: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: [{ status: 'SUBMITTED' }],
    },
  ],
};

function repository() {
  const prisma = {
    task: {
      findMany: jest.fn().mockResolvedValue([row]),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  return new TasksRepository(prisma as unknown as PrismaService);
}

describe('TasksRepository report visibility', () => {
  it('shows a collaborator only their own Task workspace and badge', async () => {
    const result = await repository().list({
      page: 1,
      limit: 20,
      organizationId: 31, // the TASK's own collaborator (program's is 30)
      userId: 2,
      globalScope: false,
    });

    expect(result.data[0]?.workspaces).toEqual([
      expect.objectContaining({ id: 1, ownerUserId: 2 }),
    ]);
    expect(result.data[0]?.hasReports).toBe(false);
  });

  it('shows the TASK lead organization all Task workspaces and reports', async () => {
    const result = await repository().list({
      page: 1,
      limit: 20,
      organizationId: 21, // the TASK's own lead (program's lead is 20)
      userId: 9,
      globalScope: false,
    });

    expect(result.data[0]?.workspaces).toHaveLength(2);
    expect(result.data[0]?.hasReports).toBe(true);
  });

  it('does not grant full visibility to the program lead when it is not also the task lead', async () => {
    // Regression guard for canSeeAllReports reading row.program.leadOrganizationId
    // instead of the task's own leadOrganizationId: org 20 leads the PROGRAM
    // but has no role on this task (task lead is 21), so it must be treated
    // like any other outsider, not granted full visibility.
    const result = await repository().list({
      page: 1,
      limit: 20,
      organizationId: 20,
      userId: 9,
      globalScope: false,
    });

    expect(result.data[0]?.workspaces).toHaveLength(0);
    expect(result.data[0]?.hasReports).toBe(false);
  });

  it('maps task collaborators to collaboratorOrganizationIds', async () => {
    const result = await repository().list({
      page: 1,
      limit: 20,
      organizationId: 21,
      userId: 9,
      globalScope: false,
    });

    expect(result.data[0]?.assigningOrganizationId).toBe(11);
    expect(result.data[0]?.leadOrganizationId).toBe(21);
    expect(result.data[0]?.collaboratorOrganizationIds).toEqual([31]);
    expect(result.data[0]?.collaboratorOrganizations).toEqual([
      organization(31),
    ]);
  });
});

describe('TasksRepository task scope', () => {
  it("scopes the task list by the TASK's own organizations, not the parent program's", async () => {
    const findMany = jest.fn().mockResolvedValue([row]);
    const prisma = {
      task: { findMany, count: jest.fn().mockResolvedValue(1) },
    };
    const repo = new TasksRepository(prisma as unknown as PrismaService);

    // org 31 is a TASK-level collaborator only; it is absent from every
    // organization field on the parent program (10/20/30).
    await repo.list({
      page: 1,
      limit: 20,
      organizationId: 31,
      userId: 1,
      globalScope: false,
    });

    const where = findMany.mock.calls[0][0].where;
    expect(where.program).toBeUndefined();
    expect(where.OR).toEqual([
      { assigningOrganizationId: 31 },
      { leadOrganizationId: 31 },
      { collaborators: { some: { organizationId: 31 } } },
    ]);

    // The row this scope targets does carry org 31 at the task level (so the
    // OR above would genuinely match it), while an unrelated org does not
    // appear anywhere on the task.
    const isInTaskScope = (organizationId: number) =>
      row.assigningOrganizationId === organizationId ||
      row.leadOrganizationId === organizationId ||
      row.collaborators.some((c) => c.organizationId === organizationId);
    expect(isInTaskScope(31)).toBe(true);
    expect(isInTaskScope(99)).toBe(false);
  });
});
