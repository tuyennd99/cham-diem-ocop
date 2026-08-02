import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { env } from '../config/env';

// Realtime notification: mỗi socket join room theo tổ chức (org:{id}) sau khi
// xác thực JWT ở handshake. Khi tạo notification, service emit tới các org room
// tương ứng để client refetch — thay cho polling.
@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const header = client.handshake.headers.authorization;
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
      if (!token) throw new Error('missing token');
      const payload = await this.jwtService.verifyAsync<{
        organizationId?: number;
      }>(token, {
        secret: env(process.env).jwtSecret,
        algorithms: ['HS256'],
        issuer: 'congan-api',
        audience: 'congan-web',
      });
      if (!payload.organizationId) throw new Error('missing organizationId');
      await client.join(`org:${payload.organizationId}`);
    } catch {
      client.disconnect(true);
    }
  }

  notifyOrganizations(organizationIds: number[]) {
    if (!this.server) return;
    for (const id of organizationIds) {
      this.server.to(`org:${id}`).emit('notification:new');
    }
  }
}
