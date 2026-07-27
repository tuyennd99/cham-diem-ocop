import { PrismaPg } from '@prisma/adapter-pg';

export * from '../generated/prisma/client';

export function createPrismaAdapter(
  connectionString = process.env.DATABASE_URL,
) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }
  return new PrismaPg(connectionString, {
    schema: new URL(connectionString).searchParams.get('schema') ?? undefined,
  });
}
