import { JwtService } from '@nestjs/jwt';
import { GATEWAY_OPTIONS } from '@nestjs/websockets/constants';
import type { GatewayMetadata } from '@nestjs/websockets/interfaces';
import type { Server, Socket } from 'socket.io';
import { AuthRepository } from '../repositories/auth.repository';
import { NotificationsGateway } from './notifications.gateway';

const authRepositoryReturning = (user: unknown) =>
  ({
    findUserById: jest.fn().mockResolvedValue(user),
  }) as unknown as AuthRepository;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
  process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
});

describe('NotificationsGateway', () => {
  type Middleware = (
    client: Socket,
    next: (error?: Error) => void,
  ) => Promise<void>;

  const installMiddleware = (gateway: NotificationsGateway): Middleware => {
    let middleware: Middleware | undefined;
    const server = {
      use: jest.fn((handler: Middleware) => {
        middleware = handler;
      }),
    } as unknown as Server;

    (
      gateway as unknown as {
        afterInit(server: Server): void;
      }
    ).afterInit(server);

    if (!middleware)
      throw new Error('Socket authentication middleware was not installed');
    return middleware;
  };

  it('rejects an expired handshake with a stable unauthorized code', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('jwt expired')),
    };
    const gateway = new NotificationsGateway(
      jwtService as unknown as JwtService,
      authRepositoryReturning(null),
    );
    const middleware = installMiddleware(gateway);
    const next = jest.fn();

    await middleware(
      {
        handshake: { auth: { token: 'expired' }, headers: {} },
        data: {},
      } as unknown as Socket,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ data: { code: 'UNAUTHORIZED' } }),
    );
  });

  it('rejects a locked account during the handshake', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 5 }),
    };
    const gateway = new NotificationsGateway(
      jwtService as unknown as JwtService,
      authRepositoryReturning({ id: 5, status: 'LOCKED', organizationId: 12 }),
    );
    const middleware = installMiddleware(gateway);
    const next = jest.fn();

    await middleware(
      {
        handshake: { auth: { token: 'locked' }, headers: {} },
        data: {},
      } as unknown as Socket,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ data: { code: 'UNAUTHORIZED' } }),
    );
  });

  it('joins the current DB organization room, not the token claim', async () => {
    const jwtService = {
      // Token carries no organizationId; the room must come from the DB.
      verifyAsync: jest.fn().mockResolvedValue({ sub: 5, organizationId: 999 }),
    };
    const authRepository = authRepositoryReturning({
      id: 5,
      status: 'ACTIVE',
      organizationId: 12,
    });
    const gateway = new NotificationsGateway(
      jwtService as unknown as JwtService,
      authRepository,
    );
    const middleware = installMiddleware(gateway);
    const join = jest.fn();
    const client = {
      handshake: { auth: { token: 'valid' }, headers: {} },
      data: {},
      join,
    } as unknown as Socket;
    const next = jest.fn();

    await middleware(client, next);
    await gateway.handleConnection(client);

    expect(next).toHaveBeenCalledWith();
    expect(authRepository.findUserById).toHaveBeenCalledWith(5);
    expect(join).toHaveBeenCalledWith('org:12');
  });

  it('uses the configured REST origin allowlist', () => {
    const previousOrigins = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = 'https://allowed.example,https://second.example';
    try {
      const options = Reflect.getMetadata(
        GATEWAY_OPTIONS,
        NotificationsGateway,
      ) as GatewayMetadata;
      const origin = options.cors?.origin;
      expect(typeof origin).toBe('function');
      if (typeof origin !== 'function') return;

      const callback = jest.fn();
      origin('https://allowed.example', callback);
      expect(callback).toHaveBeenLastCalledWith(null, true);
      origin('https://blocked.example', callback);
      expect(callback).toHaveBeenLastCalledWith(null, false);
      origin(undefined, callback);
      expect(callback).toHaveBeenLastCalledWith(null, true);
    } finally {
      if (previousOrigins === undefined) {
        delete process.env.CORS_ORIGINS;
      } else {
        process.env.CORS_ORIGINS = previousOrigins;
      }
    }
  });
});
