import type {
  AdminCategoryQuery,
  CreateAdminCategoryInput,
  CreateLocalityInput,
  CreateProductGroupInput,
  LocalityQuery,
  ProductGroupQuery,
  UpdateAdminCategoryInput,
  UpdateLocalityInput,
  UpdateProductGroupInput,
} from '@ocop/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminCatalogsApi } from '../api/admin-catalogs';
import { queryKeys } from '../constants/query-key';

export function useAdminProductGroups(query: ProductGroupQuery) {
  return useQuery({
    queryKey: queryKeys.adminCatalogs.groups.list(query),
    queryFn: () => adminCatalogsApi.groups(query),
  });
}

export function useAdminCategories(query: AdminCategoryQuery) {
  return useQuery({
    queryKey: queryKeys.adminCatalogs.categories.list(query),
    queryFn: () => adminCatalogsApi.categories(query),
  });
}

export function useAdminCategoryDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.adminCatalogs.categories.detail(id ?? ''),
    queryFn: () => adminCatalogsApi.category(id!),
    enabled: Boolean(id),
  });
}

export function useAdminLocalities(query: LocalityQuery) {
  return useQuery({
    queryKey: queryKeys.adminCatalogs.localities.list(query),
    queryFn: () => adminCatalogsApi.localities(query),
  });
}

export function useAdminCatalogMutations() {
  const queryClient = useQueryClient();

  const invalidateCatalogs = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminCatalogs.groups.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminCatalogs.categories.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    void queryClient.invalidateQueries({ queryKey: queryKeys.scoringPrint.criteriaSets.all });
  };

  const invalidateLocalities = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminCatalogs.localities.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.localities.all });
  };

  const createGroup = useMutation({
    mutationFn: (data: CreateProductGroupInput) => adminCatalogsApi.createGroup(data),
    onSuccess: invalidateCatalogs,
    retry: false,
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductGroupInput }) =>
      adminCatalogsApi.updateGroup(id, data),
    onSuccess: invalidateCatalogs,
    retry: false,
  });

  const createCategory = useMutation({
    mutationFn: (data: CreateAdminCategoryInput) => adminCatalogsApi.createCategory(data),
    onSuccess: invalidateCatalogs,
    retry: false,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAdminCategoryInput }) =>
      adminCatalogsApi.updateCategory(id, data),
    onSuccess: invalidateCatalogs,
    retry: false,
  });

  const createLocality = useMutation({
    mutationFn: (data: CreateLocalityInput) => adminCatalogsApi.createLocality(data),
    onSuccess: invalidateLocalities,
    retry: false,
  });

  const updateLocality = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLocalityInput }) =>
      adminCatalogsApi.updateLocality(id, data),
    onSuccess: invalidateLocalities,
    retry: false,
  });

  return {
    createGroup: (data: CreateProductGroupInput) => createGroup.mutateAsync(data),
    updateGroup: (id: string, data: UpdateProductGroupInput) =>
      updateGroup.mutateAsync({ id, data }),
    createCategory: (data: CreateAdminCategoryInput) => createCategory.mutateAsync(data),
    updateCategory: (id: string, data: UpdateAdminCategoryInput) =>
      updateCategory.mutateAsync({ id, data }),
    createLocality: (data: CreateLocalityInput) => createLocality.mutateAsync(data),
    updateLocality: (id: string, data: UpdateLocalityInput) =>
      updateLocality.mutateAsync({ id, data }),
  };
}
