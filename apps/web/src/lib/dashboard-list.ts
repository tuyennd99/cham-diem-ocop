export function filterDashboardList<T>(
  items: readonly T[],
  query: string,
  text: (item: T) => string,
) {
  const term = query.trim().toLocaleLowerCase('vi');
  return term ? items.filter((item) => text(item).toLocaleLowerCase('vi').includes(term)) : items;
}

export function paginateDashboardList<T>(items: readonly T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pages);
  return {
    rows: items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    page: currentPage,
    pages,
  };
}
