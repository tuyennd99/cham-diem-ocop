import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { NotificationsGateway } from './notifications.gateway';

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

  it('joins the organization room only after middleware authentication', async () => {
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ organizationId: 12 }),
    };
    const gateway = new NotificationsGateway(
      jwtService as unknown as JwtService,
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
    expect(join).toHaveBeenCalledWith('org:12');
  });
});
