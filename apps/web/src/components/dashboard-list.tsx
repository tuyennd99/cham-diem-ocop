import { useEffect, useState, type ReactNode } from 'react';
import { filterDashboardList, paginateDashboardList } from '@/lib/dashboard-list';
import { DebouncedInput } from '@/components/debounced-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function DashboardList<T>({
  label,
  items,
  searchText,
  searchItems,
  searchLabel,
  resetKey,
  children,
  server,
}: {
  label: string;
  items: readonly T[];
  searchText: (item: T) => string;
  searchItems?: readonly T[];
  searchLabel?: string;
  resetKey?: string;
  children: (items: T[]) => ReactNode;
  server?: {
    page: number;
    total: number;
    query: string;
    loading: boolean;
    onPage: (page: number) => void;
    onSearch: (query: string) => void;
  };
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [searchPending, setSearchPending] = useState(false);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  const filtered = server
    ? items
    : filterDashboardList(query.trim() ? (searchItems ?? items) : items, query, searchText);
  const result = server
    ? { rows: [...items], page: server.page, pages: Math.max(1, Math.ceil(server.total / 5)) }
    : paginateDashboardList(filtered, page, 5);
  const loading = Boolean(server && (server.loading || searchPending));

  return (
    <div className='dashboard-list'>
      {server ? (
        <DebouncedInput
          type='search'
          maxLength={100}
          aria-label={searchLabel ?? `Lọc ${label}`}
          placeholder={searchLabel ?? `Lọc ${label}`}
          value={server.query}
          onChange={() => setSearchPending(true)}
          onValueChange={(value) => {
            setSearchPending(false);
            server.onSearch(value);
          }}
        />
      ) : (
        <Input
          type='search'
          aria-label={`Lọc ${label}`}
          placeholder={`Lọc ${label}`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      )}
      {loading ? (
        <p className='text-muted text-sm' role='status'>
          Đang tải danh sách…
        </p>
      ) : result.rows.length ? (
        children(result.rows)
      ) : (
        <p className='text-muted text-sm'>Không có kết quả phù hợp.</p>
      )}
      <nav className='dashboard-list-pagination' aria-label={`Phân trang ${label}`}>
        <span aria-live='polite'>
          {loading
            ? 'Đang cập nhật…'
            : `${server?.total ?? filtered.length} kết quả · Trang ${result.page}/${result.pages}`}
        </span>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            aria-label={`Trang trước ${label}`}
            disabled={loading || result.page <= 1}
            onClick={() => (server ? server.onPage(result.page - 1) : setPage(result.page - 1))}
          >
            Trước
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            aria-label={`Trang sau ${label}`}
            disabled={loading || result.page >= result.pages}
            onClick={() => (server ? server.onPage(result.page + 1) : setPage(result.page + 1))}
          >
            Sau
          </Button>
        </div>
      </nav>
    </div>
  );
}
