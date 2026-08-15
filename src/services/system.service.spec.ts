import { BadRequestException } from '@nestjs/common';
import { SystemRepository } from '../repositories/system.repository';
import { SystemService } from './system.service';

const programInput = {
  code: 'NQ57',
  name: 'Nghị quyết 57',
  assigningOrganizationId: 10,
  leadOrganizationId: 20,
  collaboratorOrganizationIds: [30],
};

function repositoryMock() {
  return {
    findProgramByCode: jest.fn().mockResolvedValue(null),
    findProgramById: jest.fn().mockResolvedValue({ id: 1, ...programInput }),
    findOrganizationsByIds: jest.fn().mockImplementation((ids: number[]) =>
      Promise.resolve(
        ids.map((id) => ({
          id,
          status: 'ACTIVE',
          isAssigningAuthority: id === 10,
          isExecutingUnit: id !== 10,
        })),
      ),
    ),
    createProgram: jest.fn().mockResolvedValue({ id: 1, ...programInput }),
    updateProgram: jest.fn().mockResolvedValue({ id: 1, ...programInput }),
  };
}

describe('SystemService Program CRUD', () => {
  it('validates and writes assigning, lead, and collaborator organizations', async () => {
    const repository = repositoryMock();
    const service = new SystemService(
      repository as unknown as SystemRepository,
    );

    await service.createProgram(programInput, 1, {});

    expect(repository.findOrganizationsByIds).toHaveBeenCalledWith([
      10, 20, 30,
    ]);
    expect(repository.createProgram).toHaveBeenCalledWith(
      expect.objectContaining(programInput),
      1,
      {},
    );
  });

  it('rejects an organization without the required role', async () => {
    const repository = repositoryMock();
    repository.findOrganizationsByIds.mockResolvedValue([
      {
        id: 10,
        status: 'ACTIVE',
        isAssigningAuthority: true,
        isExecutingUnit: false,
      },
      {
        id: 20,
        status: 'ACTIVE',
        isAssigningAuthority: false,
        isExecutingUnit: false,
      },
      {
        id: 30,
        status: 'ACTIVE',
        isAssigningAuthority: false,
        isExecutingUnit: true,
      },
    ]);
    const service = new SystemService(
      repository as unknown as SystemRepository,
    );

    await expect(
      service.createProgram(programInput as never, 1, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates and replaces collaborators on update', async () => {
    const repository = repositoryMock();
    const service = new SystemService(
      repository as unknown as SystemRepository,
    );

    await service.updateProgram(
      1,
      { collaboratorOrganizationIds: [40] },
      1,
      {},
    );

    expect(repository.findOrganizationsByIds).toHaveBeenCalledWith([
      10, 20, 40,
    ]);
    expect(repository.updateProgram).toHaveBeenCalledWith(
      1,
      { collaboratorOrganizationIds: [40] },
      1,
      {},
    );
  });
});
