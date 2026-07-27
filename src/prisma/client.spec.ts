import { createPrismaAdapter } from './client';

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
