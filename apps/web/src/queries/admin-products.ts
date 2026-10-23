import type { AdminProductQuery } from '@ocop/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminProductsApi, myProductsApi } from '../api';
import { queryKeys } from '../constants/query-key';
import type { ProductDraftCommands } from '../lib/save-product-draft';
import type { AdminProductDetail } from '../types/admin';
import type { ApiResult } from '../types/api';
import type { ProductWriteInput, RegistrantProduct } from '../types/registrant';

export type AdminProductMode = 'products' | 'registrations';

export function useAdminProductList(
  mode: AdminProductMode,
  canManage: boolean,
  query: AdminProductQuery,
) {
  return useQuery({
    queryKey: queryKeys.adminProducts.list(mode, canManage, query),
    queryFn: () => adminProductsApi.list(query),
  });
}

export function useAdminProductDetail(mode: AdminProductMode, canManage: boolean, id: string) {
  return useQuery({
    queryKey: queryKeys.adminProducts.detail(mode, canManage, id),
    queryFn: () => adminProductsApi.detail(id),
    enabled: Boolean(id),
  });
}

export function useAdminProductResults(id: string, canManage: boolean) {
  return useQuery({
    queryKey: queryKeys.adminProducts.results(canManage, id),
    queryFn: async () => (await adminProductsApi.results(id)).data,
    enabled: Boolean(id),
  });
}

export function useProductDraftCommands(
  mode: 'owner' | 'admin',
  options: { registrantId?: string; reason?: string } = {},
): ProductDraftCommands {
  const queryClient = useQueryClient();
  const create = useMutation<ApiResult<RegistrantProduct>, unknown, ProductWriteInput>({
    mutationFn: (payload) => {
      if (mode === 'owner') return myProductsApi.create(payload);
      if (!options.registrantId) throw new Error('Chọn chủ thể đăng ký trước khi lưu.');
      if (!options.reason?.trim()) throw new Error('Nhập lý do thao tác trước khi lưu.');
      return adminProductsApi.create({
        ...payload,
        registrantId: options.registrantId,
        reason: options.reason,
      });
    },
    onSuccess: () => invalidateDraftViews(queryClient, mode),
    retry: false,
  });
  const update = useMutation<
    ApiResult<RegistrantProduct>,
    unknown,
    { id: string; payload: ProductWriteInput }
  >({
    mutationFn: ({ id, payload }) => {
      if (mode === 'owner') return myProductsApi.update(id, payload);
      if (!options.reason?.trim()) throw new Error('Nhập lý do thao tác trước khi lưu.');
      return adminProductsApi.update(id, { ...payload, reason: options.reason });
    },
    onSuccess: () => invalidateDraftViews(queryClient, mode),
    retry: false,
  });
  const upload = useMutation<
    ApiResult<import('../types/product').ProductAttachmentRecord>,
    unknown,
    { id: string; file: File }
  >({
    mutationFn: ({ id, file }) => {
      if (mode === 'owner') return myProductsApi.upload(id, file);
      if (!options.reason?.trim()) throw new Error('Nhập lý do thao tác trước khi tải tệp.');
      return adminProductsApi.upload(id, file, options.reason);
    },
    onSuccess: () => invalidateDraftViews(queryClient, mode),
    retry: false,
  });

  return {
    create: (payload) => create.mutateAsync(payload),
    update: (id, payload) => update.mutateAsync({ id, payload }),
    upload: (id, file) => upload.mutateAsync({ id, file }),
    detail: async (id) => {
      if (mode === 'owner') return myProductsApi.detail(id);
      const result = await adminProductsApi.detail(id);
      return { ...result, data: result.data as unknown as RegistrantProduct };
    },
  };
}

export function useAdminProductMutations(id: string, mode: AdminProductMode, canManage: boolean) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminProducts.all });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.adminProducts.detail(mode, canManage, id),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.adminProducts.results(canManage, id),
    });
  };
  const submit = useMutation({
    mutationFn: (reason: string) => adminProductsApi.submit(id, reason),
    onSuccess: invalidate,
    retry: false,
  });
  const remove = useMutation({
    mutationFn: (reason: string) => adminProductsApi.remove(id, reason),
    onSuccess: invalidate,
    retry: false,
  });
  const removeAttachment = useMutation({
    mutationFn: ({ attachmentId, reason }: { attachmentId: string; reason: string }) =>
      adminProductsApi.removeAttachment(id, attachmentId, reason),
    onSuccess: invalidate,
    retry: false,
  });
  return {
    submit: (reason: string) => submit.mutateAsync(reason),
    remove: (reason: string) => remove.mutateAsync(reason),
    removeAttachment: (attachmentId: string, reason: string) =>
      removeAttachment.mutateAsync({ attachmentId, reason }),
  };
}

function invalidateDraftViews(
  queryClient: ReturnType<typeof useQueryClient>,
  mode: 'owner' | 'admin',
) {
  void queryClient.invalidateQueries({
    queryKey: mode === 'owner' ? queryKeys.myProducts.all : queryKeys.adminProducts.all,
  });
}

export function asRegistrantProduct(detail: AdminProductDetail): RegistrantProduct {
  return detail as unknown as RegistrantProduct;
}
