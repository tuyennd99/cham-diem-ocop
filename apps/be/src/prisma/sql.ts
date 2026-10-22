import { Prisma } from '@prisma/client';

function quoteIdentifier(value: string) {
  if (!value || value.includes('\0')) throw new Error('Invalid database identifier');
  return `"${value.replaceAll('"', '""')}"`;
}

export function databaseObject(name: string, databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const schema = new URL(databaseUrl).searchParams.get('schema') ?? 'public';
  return Prisma.raw(`${quoteIdentifier(schema)}.${quoteIdentifier(name)}`);
}
