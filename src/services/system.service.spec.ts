import { SystemRepository } from '../repositories/system.repository';
import { SystemService } from './system.service';

const user = {
  id: 9,
  username: 'managed-user',
  fullName: 'Managed User',
  organizationId: 10,
  status: 'ACTIVE',
};

describe('SystemService administration', () => {
  let service: SystemService;
  let repository: Record<string, jest.Mock>;

  beforeEach(() => {
    repository = {
      findUserById: jest.fn().mockResolvedValue(user),
      findUserByUsername: jest.fn().mockResolvedValue(null),
      findOrganizationById: jest.fn().mockResolvedValue({ id: 10 }),
      createUser: jest.fn().mockResolvedValue(user),
      updateUser: jest.fn().mockResolvedValue(user),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      lockUser: jest.fn().mockResolvedValue(user),
    };
    service = new SystemService(repository as unknown as SystemRepository);
  });

  it('creates a user from profile fields only, without group data', async () => {
    await expect(
      service.createUser(
        {
          username: 'new-user',
          fullName: 'New User',
          password: 'strong-password-value',
          organizationId: 10,
        },
        1,
        {},
      ),
    ).resolves.toMatchObject({ id: 9 });

    const [data, actorId] = repository.createUser.mock.calls[0];
    expect(actorId).toBe(1);
    expect(data).toMatchObject({ username: 'new-user', organizationId: 10 });
    expect(data).not.toHaveProperty('permissionGroupIds');
  });

  it('updates a user without group data', async () => {
    await expect(
      service.updateUser(9, { fullName: 'Renamed' }, 1, {}),
    ).resolves.toMatchObject({ id: 9 });

    expect(repository.updateUser.mock.calls[0][1]).not.toHaveProperty(
      'permissionGroupIds',
    );
  });

  it('rejects deleting user 1', async () => {
    repository.findUserById.mockResolvedValue({ ...user, id: 1 });

    await expect(service.deleteUser(1, 2, {})).rejects.toMatchObject({
      response: {
        errorCode: 'DEFAULT_ADMIN_PROTECTED',
        message: expect.any(String),
      },
    });
  });

  it('rejects locking user 1', async () => {
    repository.findUserById.mockResolvedValue({ ...user, id: 1 });

    await expect(
      service.lockUser(1, 'Manual review', 2, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'DEFAULT_ADMIN_PROTECTED',
        message: expect.any(String),
      },
    });
  });
});
