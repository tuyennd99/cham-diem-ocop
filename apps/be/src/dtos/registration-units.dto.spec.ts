import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegistrationUnitWriteDto } from './products.dto';

describe('RegistrationUnitWriteDto', () => {
  it('trims required fields and normalizes optional fields', async () => {
    const dto = plainToInstance(RegistrationUnitWriteDto, {
      entityName: '  HTX Nông nghiệp Tân Cương  ',
      representativeName: '  Nguyễn Văn A  ',
      representativeTitle: '  Giám đốc  ',
      contactAddress: '  Xóm Hồng Thái 2, xã Tân Cương  ',
      provinceName: '  Tỉnh Thái Nguyên  ',
      localityName: '  Xã Tân Cương  ',
      localityCode: '  XP12345  ',
      phone: '  0912345678  ',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto).toEqual({
      entityName: 'HTX Nông nghiệp Tân Cương',
      representativeName: 'Nguyễn Văn A',
      representativeTitle: 'Giám đốc',
      contactAddress: 'Xóm Hồng Thái 2, xã Tân Cương',
      provinceName: 'Tỉnh Thái Nguyên',
      localityName: 'Xã Tân Cương',
      localityCode: 'XP12345',
      phone: '0912345678',
    });
  });

  it('normalizes blank optional fields to null', async () => {
    const dto = plainToInstance(RegistrationUnitWriteDto, {
      entityName: 'HTX Trà Xanh',
      representativeName: 'Trần Thị B',
      representativeTitle: 'Chủ tịch HĐQT',
      contactAddress: 'Thôn 1, xã La Bằng',
      provinceName: 'Tỉnh Thái Nguyên',
      localityName: 'Xã La Bằng',
      localityCode: '   ',
      phone: '',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.localityCode).toBeNull();
    expect(dto.phone).toBeNull();
  });

  it('rejects missing or whitespace-only required fields and over-length values', async () => {
    const dto = plainToInstance(RegistrationUnitWriteDto, {
      entityName: '   ',
      representativeName: '',
      representativeTitle: 'G'.repeat(256),
      contactAddress: 'A'.repeat(1001),
      provinceName: 'P'.repeat(101),
      localityName: '   ',
      localityCode: 'C'.repeat(51),
      phone: '9'.repeat(31),
    });

    const errors = await validate(dto);
    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining([
        'entityName',
        'representativeName',
        'representativeTitle',
        'contactAddress',
        'provinceName',
        'localityName',
        'localityCode',
        'phone',
      ]),
    );
  });

  it('rejects non-whitelisted fields such as registrantId or email', async () => {
    const dto = plainToInstance(RegistrationUnitWriteDto, {
      entityName: 'HTX Trà Xanh',
      representativeName: 'Trần Thị B',
      representativeTitle: 'Giám đốc',
      contactAddress: 'Thôn 1, xã La Bằng',
      provinceName: 'Tỉnh Thái Nguyên',
      localityName: 'Xã La Bằng',
      registrantId: 'other-user-id',
      email: 'other@example.com',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map(({ property }) => property)).toEqual(
      expect.arrayContaining(['registrantId', 'email']),
    );
  });
});
