import { Prisma, ProductStatus } from '@prisma/client';

// Call within the status-change transaction while holding the product/category lock.
export async function recordProductStatusEvent(
  tx: Prisma.TransactionClient,
  productId: string,
  fromStatus: ProductStatus | null,
  toStatus: ProductStatus,
  actorId: string,
  createdAt = new Date(),
) {
  if (fromStatus === toStatus) return;
  const latest = await tx.productStatusEvent.aggregate({ where: { productId }, _max: { sequence: true } });
  await tx.productStatusEvent.create({ data: {
    productId, fromStatus, toStatus, actorId, createdAt, sequence: (latest._max.sequence ?? 0) + 1,
  } });
}
