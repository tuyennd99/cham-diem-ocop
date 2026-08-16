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
  assigningOrganizationId: 10,
  leadOrganizationId: 20,
  assigningOrganization: organization(10),
  leadOrganization: organization(20),
  collaborators: [
    {
      id: 1,
      taskId: 7,
      organizationId: 30,
      createdAt: new Date(),
      organization: organization(30),
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
      organizationId: 30,
      userId: 2,
      globalScope: false,
    });

    expect(result.data[0]?.workspaces).toEqual([
      expect.objectContaining({ id: 1, ownerUserId: 2 }),
    ]);
    expect(result.data[0]?.hasReports).toBe(false);
  });

  it('shows the lead organization all Task workspaces and reports', async () => {
    const result = await repository().list({
      page: 1,
      limit: 20,
      organizationId: 20,
      userId: 9,
      globalScope: false,
    });

    expect(result.data[0]?.workspaces).toHaveLength(2);
    expect(result.data[0]?.hasReports).toBe(true);
  });

  it('maps task collaborators to collaboratorOrganizationIds', async () => {
    const result = await repository().list({
      page: 1,
      limit: 20,
      organizationId: 20,
      userId: 9,
      globalScope: false,
    });

    expect(result.data[0]?.assigningOrganizationId).toBe(10);
    expect(result.data[0]?.leadOrganizationId).toBe(20);
    expect(result.data[0]?.collaboratorOrganizationIds).toEqual([30]);
    expect(result.data[0]?.collaboratorOrganizations).toEqual([
      organization(30),
    ]);
  });
});
