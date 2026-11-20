import type { Prisma } from '@prisma/client';

export async function generateNextLocalityCode(
  tx: Prisma.TransactionClient,
  existingCodes?: Iterable<string>,
): Promise<string> {
  const codes = existingCodes
    ? [...existingCodes]
    : (await tx.locality.findMany({ select: { code: true } })).map(
        (r) => r.code,
      );
  const usedCodes = new Set(codes.map((c) => c.toUpperCase()));
  let seq = codes.length + 1;
  while (usedCodes.has(`XP${seq}`)) {
    seq += 1;
  }
  return `XP${seq}`;
}
