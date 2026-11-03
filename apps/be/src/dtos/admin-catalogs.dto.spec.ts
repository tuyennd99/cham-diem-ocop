import { BadRequestException, ValidationPipe, type Type } from '@nestjs/common';
import {
  AdminLocalitiesQueryDto,
  CreateLocalityDto,
  UpdateLocalityDto,
} from './admin-catalogs.dto';

describe('locality DTO validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const validate = (value: object, metatype: Type<object>) =>
    pipe.transform(value, { type: 'body', metatype });
  const create = {
    code: 'TEST-L-1',
    name: 'Test locality',
    provinceName: 'Test province',
    isActive: true,
    reason: 'Catalog update',
  };

  it('accepts offset timestamps, optional code, eventName and registration dates', async () => {
    await expect(
      validate(
        {
          name: ' Test locality ',
          eventName: ' Đợt 1 năm 2026 ',
          provinceName: ' Test province ',
          effectiveFrom: '2026-05-01T00:00:00+07:00',
          effectiveTo: '2026-11-01T00:00:00+07:00',
          registrationFrom: '2026-05-01T00:00:00+07:00',
          registrationTo: '2026-10-01T00:00:00+07:00',
          isActive: true,
          reason: 'Catalog update',
        },
        CreateLocalityDto,
      ),
    ).resolves.toMatchObject({
      name: 'Test locality',
      eventName: 'Đợt 1 năm 2026',
      provinceName: 'Test province',
      effectiveFrom: '2026-05-01T00:00:00+07:00',
      registrationFrom: '2026-05-01T00:00:00+07:00',
    });
  });

  it.each([
    { effectiveFrom: '2026-01-01T00:00:00' },
    { effectiveFrom: '2026-02-30T00:00:00Z' },
    {
      effectiveFrom: '2027-01-01T00:00:00Z',
      effectiveTo: '2026-01-01T00:00:00Z',
    },
    {
      registrationFrom: '2027-01-01T00:00:00Z',
      registrationTo: '2026-01-01T00:00:00Z',
    },
  ])('rejects invalid effective date input %p', async (dates) => {
    await expect(
      validate({ ...create, ...dates }, CreateLocalityDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts partial date updates for validation against the stored interval', async () => {
    await expect(
      validate(
        { effectiveTo: '2027-01-01T00:00:00Z', reason: 'Extend term' },
        UpdateLocalityDto,
      ),
    ).resolves.toBeDefined();
  });

  it.each(['1', 'FALSE', ['true', 'false']])(
    'accepts only a single lowercase boolean query value: %p',
    async (isActive) => {
      await expect(
        validate({ isActive }, AdminLocalitiesQueryDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
