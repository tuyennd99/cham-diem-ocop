import provinceWardsRaw from '../../public/province_ward.json';

interface RawWardEntry {
  ward_code: string;
  name: string;
  province_code: string;
}

interface RawProvinceEntry {
  province_code: string;
  name: string;
  short_name: string;
  code: string;
  place_type: string;
  wards: RawWardEntry[];
}

export interface AdministrativeProvince {
  code: string;
  name: string;
  short_name: string;
  place_type: string;
  name_with_type: string;
}

export interface AdministrativeWard {
  code: string;
  name: string;
  name_with_type: string;
  parent_code: string;
}

function stripAdministrativePrefix(fullName: string): string {
  return fullName.replace(/^(Thành phố|Tỉnh|Phường|Xã|Đặc khu)\s+/i, '').trim();
}

const rawProvinces = provinceWardsRaw as RawProvinceEntry[];

export const ADMINISTRATIVE_PROVINCES: AdministrativeProvince[] = rawProvinces
  .map((item) => ({
    code: item.province_code,
    name: stripAdministrativePrefix(item.name),
    short_name: item.short_name,
    place_type: item.place_type,
    name_with_type: item.name,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

const provinceByCodeMap = new Map<string, AdministrativeProvince>();
const provinceByNameMap = new Map<string, AdministrativeProvince>();
const wardsByProvinceCodeMap = new Map<string, AdministrativeWard[]>();

for (const item of rawProvinces) {
  const province = ADMINISTRATIVE_PROVINCES.find((p) => p.code === item.province_code);
  if (province) {
    provinceByCodeMap.set(province.code, province);
    provinceByCodeMap.set(item.code, province);
    provinceByNameMap.set(province.name_with_type, province);
    provinceByNameMap.set(province.name, province);
    provinceByNameMap.set(province.short_name, province);
  }

  const wards: AdministrativeWard[] = (item.wards ?? [])
    .map((ward) => ({
      code: ward.ward_code,
      name: stripAdministrativePrefix(ward.name),
      name_with_type: ward.name,
      parent_code: ward.province_code,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  wardsByProvinceCodeMap.set(item.province_code, wards);
}

export function findProvinceByNameOrCode(value?: string | null): AdministrativeProvince | null {
  if (!value) return null;
  const trimmed = value.trim();
  return provinceByNameMap.get(trimmed) ?? provinceByCodeMap.get(trimmed) ?? null;
}

export function useWardsByProvince(provinceNameOrCode?: string | null): AdministrativeWard[] {
  const province = findProvinceByNameOrCode(provinceNameOrCode);
  if (!province) return [];
  return wardsByProvinceCodeMap.get(province.code) ?? [];
}
