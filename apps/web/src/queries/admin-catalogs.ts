import type {
  AdminCategoryQuery,
  CreateAdminCategoryInput,
  CreateLocalityInput,
  LocalityQuery,
  UpdateAdminCategoryInput,
  UpdateLocalityInput,
} from '@ocop/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminCatalogsApi } from '../api/admin-catalogs';
import { HTTP_STATUS } from '../constants/http-status';
import { queryKeys } from '../constants/query-key';
import { ApiError, messageOf } from '../lib/api-error';

export function useAdminCategories(query: AdminCategoryQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.adminCatalogs.categories.list(query),
    queryFn: () => adminCatalogsApi.categories(query),
    enabled,
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
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminCatalogs.categories.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
    void queryClient.invalidateQueries({ queryKey: queryKeys.scoringPrint.criteriaSets.all });
  };

  const invalidateLocalities = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminCatalogs.localities.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.localities.all });
  };

  const createCategory = useMutation({
    mutationFn: (data: CreateAdminCategoryInput) => adminCatalogsApi.createCategory(data),
    onSuccess: (res) => {
      invalidateCatalogs();
      toast.success(`Đã thêm danh mục ${res.data.name}.`);
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAdminCategoryInput }) =>
      adminCatalogsApi.updateCategory(id, data),
    onSuccess: (res) => {
      invalidateCatalogs();
      toast.success(`Đã cập nhật danh mục ${res.data.name}.`);
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });

  const createLocality = useMutation({
    mutationFn: (data: CreateLocalityInput) => adminCatalogsApi.createLocality(data),
    onSuccess: (res) => {
      invalidateLocalities();
      toast.success(`Đã thêm địa bàn ${res.data.name} vào danh mục.`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === HTTP_STATUS.CONFLICT) return;
      toast.error(messageOf(err));
    },
    retry: false,
  });

  const updateLocality = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLocalityInput }) =>
      adminCatalogsApi.updateLocality(id, data),
    onSuccess: (res) => {
      invalidateLocalities();
      toast.success(`Đã cập nhật địa bàn ${res.data.name}.`);
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });

  return {
    createCategory: (data: CreateAdminCategoryInput) => createCategory.mutateAsync(data),
    updateCategory: (id: string, data: UpdateAdminCategoryInput) =>
      updateCategory.mutateAsync({ id, data }),
    createLocality: (data: CreateLocalityInput) => createLocality.mutateAsync(data),
    updateLocality: (id: string, data: UpdateLocalityInput) =>
      updateLocality.mutateAsync({ id, data }),
  };
}
