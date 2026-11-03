import type { LocalityQuery } from '@ocop/shared';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { parseAdminLocalitiesSearch } from '../../lib/admin-search';
import { useSession } from '../../lib/auth';
import { hasStaffPermission } from '../../lib/session-contract';
import { useAdminCatalogMutations } from '../../queries/admin-catalogs';
import { LocalitiesPanel } from './LocalitiesPanel';

interface AdminLocalitiesPageProps {
  search?: LocalityQuery;
  onSearchChange?: (next: LocalityQuery) => void;
}

export function AdminLocalitiesPage({
  search: controlledSearch,
  onSearchChange,
}: AdminLocalitiesPageProps) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const mutations = useAdminCatalogMutations();

  const appliedSearch: LocalityQuery = controlledSearch ?? {
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  };

  function handleQueryChange(nextQuery: LocalityQuery) {
    const normalized = parseAdminLocalitiesSearch(nextQuery as Record<string, unknown>);
    onSearchChange?.(normalized);
  }

  return (
    <LocalitiesPanel
      canManage={canManage}
      query={appliedSearch}
      onQueryChange={onSearchChange ? handleQueryChange : undefined}
      onCreate={mutations.createLocality}
      onUpdate={mutations.updateLocality}
    />
  );
}
