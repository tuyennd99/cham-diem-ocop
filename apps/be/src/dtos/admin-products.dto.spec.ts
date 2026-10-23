import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminProductQueryDto } from './admin-products.dto';

describe('AdminProductQueryDto', () => {
  it('accepts offset timestamps and strict boolean values', async () => {
    const query = plainToInstance(AdminProductQueryDto, {
      from: '2026-10-01T00:00:00+07:00',
      toExclusive: '2026-11-01T00:00:00+07:00',
      unmappedLocality: 'false',
      assessmentYear: '2026',
    });

    expect(await validate(query)).toEqual([]);
    expect(query.unmappedLocality).toBe(false);
    expect(query.assessmentYear).toBe(2026);
    expect(query.dateBasis).toBe('submittedAt');
  });

  it('rejects offsetless timestamps and non-boolean query values', async () => {
    const query = plainToInstance(AdminProductQueryDto, {
      from: '2026-10-01T00:00:00',
      toExclusive: '2026-11-01T00:00:00Z',
      unmappedLocality: 'yes',
    });

    const errors = await validate(query);
    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(['from', 'unmappedLocality']),
    );
  });
});
