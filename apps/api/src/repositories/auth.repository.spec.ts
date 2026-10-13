import { PrismaService } from '../prisma/prisma.service';
import { AuthRepository } from './auth.repository';

const now = new Date('2026-07-24T00:00:00.000Z');
const meta = { ipAddress: '127.0.0.1', requestId: 'request-1' };

describe('AuthRepository failed-login transaction', () => {
  function setup(
    failedLoginCount: number,
    failedLoginWindowStartedAt: Date | null,
    status: 'ACTIVE' | 'LOCKED' = 'ACTIVE',
    lockedUntil: Date | null = null,
  ) {
    let observedSql: { strings: string[] } | undefined;
    let observedUpdate: unknown;
    const observedAuditActions: string[] = [];
    const transaction = {
      $queryRaw: jest.fn((query: unknown) => {
        observedSql = query as { strings: string[] };
        return Promise.resolve([
          {
            failedLoginCount,
            failedLoginWindowStartedAt,
            status,
            lockedUntil,
          },
        ]);
      }),
      user: {
        update: jest.fn((args: unknown) => {
          observedUpdate = args;
          return Promise.resolve(undefined);
        }),
      },
      refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: {
        create: jest.fn((args: unknown) => {
          observedAuditActions.push(
            (args as { data: { action: string } }).data.action,
          );
          return Promise.resolve(undefined);
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    return {
      repository: new AuthRepository(prisma as unknown as PrismaService),
      transaction,
      getObservedSql: () => observedSql,
      getObservedUpdate: () => observedUpdate,
      observedAuditActions,
    };
  }

  it('locks the fifth failure inside a row-locked transaction', async () => {
    const { repository, getObservedSql, getObservedUpdate } = setup(
      4,
      new Date(now.getTime() - 30_000),
    );

    const result = await repository.registerFailedLogin(1, now, meta);

    const sql = getObservedSql()?.strings.join('');
    expect(sql).toContain('FOR UPDATE');
    expect(getObservedUpdate()).toMatchObject({
      data: {
        status: 'LOCKED',
        failedLoginCount: 5,
        lockedUntil: new Date(now.getTime() + 5 * 60_000),
      },
    });
    expect(result).toEqual({
      locked: true,
      lockedUntil: new Date(now.getTime() + 5 * 60_000),
    });
  });

  it('starts a new failure window after sixty seconds', async () => {
    const { repository, getObservedUpdate } = setup(
      4,
      new Date(now.getTime() - 60_001),
    );

    const result = await repository.registerFailedLogin(1, now, meta);

    expect(getObservedUpdate()).toMatchObject({
      data: {
        status: 'ACTIVE',
        failedLoginCount: 1,
        failedLoginWindowStartedAt: now,
      },
    });
    expect(result).toEqual({ locked: false, lockedUntil: null });
  });

  it('does not overwrite a concurrent manual lock', async () => {
    const { repository, getObservedUpdate, observedAuditActions } = setup(
      0,
      null,
      'LOCKED',
      null,
    );

    const result = await repository.registerFailedLogin(1, now, meta);

    expect(getObservedUpdate()).toBeUndefined();
    expect(observedAuditActions).toContain('AUTH_LOGIN_FAILED');
    expect(result).toEqual({ locked: true, lockedUntil: null });
  });

  it('sanitizes an invalid request id before writing audit data', async () => {
    let requestId: unknown;
    const prisma = {
      auditLog: {
        create: jest.fn((args: unknown) => {
          requestId = (args as { data: { requestId?: unknown } }).data
            .requestId;
          return Promise.resolve(undefined);
        }),
      },
    };
    const repository = new AuthRepository(prisma as unknown as PrismaService);

    await repository.recordUnknownLoginFailure('missing', {
      requestId: 'bad\r\ninjected',
    });

    expect(requestId).toEqual(
      expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
    );
  });
});

describe('AuthRepository serialized auth transitions', () => {
  function setup(userRow: Record<string, unknown>) {
    const observedSql: string[] = [];
    const observedUserUpdates: unknown[] = [];
    const observedSessionCreates: unknown[] = [];
    const transaction = {
      $queryRaw: jest.fn((query: unknown) => {
        observedSql.push((query as { strings: string[] }).strings.join(''));
        return Promise.resolve([userRow]);
      }),
      user: {
        update: jest.fn((args: unknown) => {
          observedUserUpdates.push(args);
          return Promise.resolve(undefined);
        }),
      },
      refreshSession: {
        create: jest.fn((args: unknown) => {
          observedSessionCreates.push(args);
          return Promise.resolve(undefined);
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      ...transaction,
      $transaction: jest.fn(
        (
          input:
            | ((client: typeof transaction) => Promise<unknown>)
            | Promise<unknown>[],
        ) =>
          typeof input === 'function' ? input(transaction) : Promise.all(input),
      ),
    };
    return {
      repository: new AuthRepository(prisma as unknown as PrismaService),
      transaction,
      observedSql,
      observedUserUpdates,
      observedSessionCreates,
    };
  }

  it('atomically rechecks the password and creates a login session', async () => {
    const state = setup({
      id: 1,
      passwordHash: 'expected-hash',
      status: 'ACTIVE',
      deletedAt: null,
    });
    const expiresAt = new Date(now.getTime() + 60_000);

    await expect(
      state.repository.completeLogin(
        1,
        'expected-hash',
        'refresh-hash',
        expiresAt,
        now,
        meta,
      ),
    ).resolves.toBe(true);

    expect(state.observedSql.join('')).toContain('FOR UPDATE');
    const userUpdate = state.observedUserUpdates[0] as {
      data: {
        failedLoginCount: number;
        failedLoginWindowStartedAt: Date | null;
      };
    };
    expect(userUpdate.data).toMatchObject({
      failedLoginCount: 0,
      failedLoginWindowStartedAt: null,
    });
    expect(state.observedSessionCreates).toContainEqual({
      data: { userId: 1, tokenHash: 'refresh-hash', expiresAt },
    });
  });

  it('rejects a login transition when the password hash changed', async () => {
    const state = setup({
      id: 1,
      passwordHash: 'changed-hash',
      status: 'ACTIVE',
      deletedAt: null,
    });

    await expect(
      state.repository.completeLogin(
        1,
        'expected-hash',
        'refresh-hash',
        new Date(now.getTime() + 60_000),
        now,
        meta,
      ),
    ).resolves.toBe(false);
    expect(state.observedSessionCreates).toHaveLength(0);
  });

  it('only auto-unlocks the same expired automatic lock', async () => {
    const lockedUntil = new Date(now.getTime() - 1);
    const state = setup({
      id: 1,
      status: 'LOCKED',
      lockedUntil,
    });

    await expect(
      state.repository.unlockAutomatically(1, lockedUntil, now, meta),
    ).resolves.toBe(true);
    expect(state.observedSql.join('')).toContain('FOR UPDATE');

    const manual = setup({ id: 1, status: 'LOCKED', lockedUntil: null });
    await expect(
      manual.repository.unlockAutomatically(1, lockedUntil, now, meta),
    ).resolves.toBe(false);
    expect(manual.observedUserUpdates).toHaveLength(0);
  });

  it('locks the user row before rotating or revoking all sessions', async () => {
    const rotate = setup({ id: 1 });
    await rotate.repository.rotateSession(
      7,
      1,
      'next-hash',
      new Date(now.getTime() + 60_000),
      now,
      meta,
    );
    expect(rotate.observedSql.join('')).toContain('FOR UPDATE');

    const revoke = setup({ id: 1 });
    await revoke.repository.revokeAllSessions(1, now, 'LOGOUT_ALL', meta);
    expect(revoke.observedSql.join('')).toContain('FOR UPDATE');
  });

  it('locks and rechecks the current hash before changing password', async () => {
    const state = setup({
      id: 1,
      passwordHash: 'expected-hash',
      status: 'ACTIVE',
      deletedAt: null,
    });

    await expect(
      state.repository.changePassword(
        1,
        'expected-hash',
        'new-hash',
        now,
        meta,
      ),
    ).resolves.toBe(true);
    expect(state.observedSql.join('')).toContain('FOR UPDATE');

    const changed = setup({
      id: 1,
      passwordHash: 'changed-hash',
      status: 'ACTIVE',
      deletedAt: null,
    });
    await expect(
      changed.repository.changePassword(
        1,
        'expected-hash',
        'new-hash',
        now,
        meta,
      ),
    ).resolves.toBe(false);
    expect(changed.observedUserUpdates).toHaveLength(0);
  });
});
