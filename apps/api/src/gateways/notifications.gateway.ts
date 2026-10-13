import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { UserStatus } from '@prisma/client';
import { env } from '../config/env';
import { AuthRepository } from '../repositories/auth.repository';

type NotificationSocketData = {
  organizationId?: number;
};

// Realtime notification: mỗi socket join room theo tổ chức (org:{id}) sau khi
// xác thực JWT ở handshake. Khi tạo notification, service emit tới các org room
// tương ứng để client refetch — thay cho polling.
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const { allowedOrigins } = env(process.env);
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
  },
  path: '/api/socket.io',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayInit
{
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly authRepository: AuthRepository,
  ) {}

  afterInit(server: Server) {
    // socket.io's middleware type expects a void return, but this handler
    // intentionally returns its inner promise so tests can await full
    // completion of the async auth flow before asserting on `next`.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    server.use((client, next) => {
      return (async () => {
        try {
          const header = client.handshake.headers.authorization;
          const token =
            (client.handshake.auth?.token as string | undefined) ??
            (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
          if (!token) throw new Error('missing token');
          const payload = await this.jwtService.verifyAsync<{
            sub?: number;
          }>(token, {
            secret: env(process.env).jwtSecret,
            algorithms: ['HS256'],
            issuer: 'congan-api',
            audience: 'congan-web',
          });
          if (!Number.isInteger(payload.sub)) throw new Error('missing sub');
          const user = await this.authRepository.findUserById(payload.sub);
          if (!user || user.status !== UserStatus.ACTIVE)
            throw new Error('inactive account');
          (client.data as NotificationSocketData).organizationId =
            user.organizationId;
          next();
        } catch {
          const error = new Error('Unauthorized') as Error & {
            data: { code: string };
          };
          error.data = { code: 'UNAUTHORIZED' };
          next(error);
        }
      })();
    });
  }

  async handleConnection(client: Socket) {
    const { organizationId } = client.data as NotificationSocketData;
    await client.join(`org:${organizationId}`);
  }

  notifyOrganizations(organizationIds: number[]) {
    if (!this.server) return;
    for (const id of organizationIds) {
      this.server.to(`org:${id}`).emit('notification:new');
    }
  }
}
