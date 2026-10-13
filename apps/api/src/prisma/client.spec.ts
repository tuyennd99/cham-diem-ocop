import { createPrismaAdapter } from './client';
import { PrismaService } from './prisma.service';

describe('createPrismaAdapter', () => {
  it('requires DATABASE_URL', () => {
    expect(() => createPrismaAdapter('')).toThrow('DATABASE_URL is required');
  });

  it('passes the schema query parameter to PrismaPg', async () => {
    const adapter = createPrismaAdapter(
      'postgresql://user:password@127.0.0.1:5432/congan_task?schema=reporting',
    );
    const connection = await adapter.connect();

    expect(connection.getConnectionInfo().schemaName).toBe('reporting');

    await connection.dispose();
  });
});

describe('PrismaService', () => {
  it('disconnects the database client when the module is destroyed', async () => {
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const service = Object.create(PrismaService.prototype) as PrismaService;
    Object.defineProperty(service, '$disconnect', { value: disconnect });

    await (
      service as unknown as { onModuleDestroy(): Promise<void> }
    ).onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
