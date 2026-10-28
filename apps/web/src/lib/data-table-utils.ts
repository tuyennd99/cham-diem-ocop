export interface DataTableParams {
  page: number; // 1-based
  limit: number;
  sort: { id: string; desc: boolean } | null;
  search: string;
}

export function getPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(page, 1), pageCount);
}
