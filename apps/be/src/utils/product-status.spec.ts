import { recordProductStatusEvent } from './product-status';

describe('recordProductStatusEvent', () => {
  it('does not record a no-op transition', async () => {
    const tx = { productStatusEvent: { aggregate: jest.fn(), create: jest.fn() } };

    await recordProductStatusEvent(tx as never, 'product-1', 'SCORING', 'SCORING', 'judge-1');

    expect(tx.productStatusEvent.aggregate).not.toHaveBeenCalled();
    expect(tx.productStatusEvent.create).not.toHaveBeenCalled();
  });

  it('uses the next per-product sequence for a real transition', async () => {
    const tx = {
      productStatusEvent: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: 2 } }),
        create: jest.fn(),
      },
    };
    const createdAt = new Date('2026-10-22T00:00:00.000Z');

    await recordProductStatusEvent(tx as never, 'product-1', 'SUBMITTED', 'SCORING', 'judge-1', createdAt);

    expect(tx.productStatusEvent.create).toHaveBeenCalledWith({ data: {
      productId: 'product-1', fromStatus: 'SUBMITTED', toStatus: 'SCORING',
      actorId: 'judge-1', createdAt, sequence: 3,
    } });
  });
});
