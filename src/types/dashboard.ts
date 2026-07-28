export type DashboardStatus =
  | 'HOAN_THANH'
  | 'DANG_CAP_NHAT'
  | 'QUA_HAN'
  | 'SAP_DEN_HAN'
  | 'CHUA_HOAN_THANH';

export type DashboardStatusCounts = Record<DashboardStatus, number>;
