import type { AdminProductQuery } from '@ocop/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminProductsApi, myProductsApi } from '../api';
import { PRODUCT_WORKSPACE_MODE } from '../constants/consts';
import { queryKeys } from '../constants/query-key';
import { messageOf } from '../lib/api-error';
import type { ProductDraftCommands } from '../lib/save-product-draft';
import type { AdminProductDetail } from '../types/admin';
import type { ApiResult } from '../types/api';
import type { ProductWriteInput, RegistrantProduct } from '../types/registrant';

export type AdminProductMode =
  typeof PRODUCT_WORKSPACE_MODE.PRODUCTS | typeof PRODUCT_WORKSPACE_MODE.REGISTRATIONS;

export function useAdminProductList(
  mode: AdminProductMode,
  canManage: boolean,
  query: AdminProductQuery,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.adminProducts.list(mode, canManage, query),
    queryFn: () => adminProductsApi.list(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAdminProductDetail(
  mode: AdminProductMode,
  canManage: boolean,
  id: string,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.adminProducts.detail(mode, canManage, id),
    queryFn: () => adminProductsApi.detail(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useAdminProductResults(id: string, canManage: boolean) {
  return useQuery({
    queryKey: queryKeys.adminProducts.results(canManage, id),
    queryFn: async () => (await adminProductsApi.results(id)).data,
    enabled: Boolean(id),
  });
}

export function useProductEligibleJudges(id: string, enabled = true) {
  return useQuery({
    queryKey: ['admin-products', 'eligible-judges', id] as const,
    queryFn: async () => (await adminProductsApi.eligibleJudges(id)).data,
    enabled: Boolean(id) && enabled,
  });
}

export function useProductDraftCommands(
  mode: typeof PRODUCT_WORKSPACE_MODE.OWNER | typeof PRODUCT_WORKSPACE_MODE.ADMIN,
  options: { registrantId?: string; reason?: string } = {},
): ProductDraftCommands {
  const create = useMutation<ApiResult<RegistrantProduct>, unknown, ProductWriteInput>({
    mutationFn: (payload) => {
      if (mode === PRODUCT_WORKSPACE_MODE.OWNER) return myProductsApi.create(payload);
      if (!options.registrantId) throw new Error('Chọn người đăng ký trước khi lưu.');
      if (!options.reason?.trim()) throw new Error('Nhập lý do thao tác trước khi lưu.');
      return adminProductsApi.create({
        ...payload,
        registrantId: options.registrantId,
        reason: options.reason,
      });
    },
    retry: false,
  });
  const update = useMutation<
    ApiResult<RegistrantProduct>,
    unknown,
    { id: string; payload: ProductWriteInput }
  >({
    mutationFn: ({ id, payload }) => {
      if (mode === PRODUCT_WORKSPACE_MODE.OWNER) return myProductsApi.update(id, payload);
      if (!options.reason?.trim()) throw new Error('Nhập lý do thao tác trước khi lưu.');
      return adminProductsApi.update(id, { ...payload, reason: options.reason });
    },
    retry: false,
  });
  const upload = useMutation<
    ApiResult<import('../types/product').ProductAttachmentRecord>,
    unknown,
    { id: string; file: File }
  >({
    mutationFn: ({ id, file }) => {
      if (mode === PRODUCT_WORKSPACE_MODE.OWNER) return myProductsApi.upload(id, file);
      if (!options.reason?.trim()) throw new Error('Nhập lý do thao tác trước khi tải tệp.');
      return adminProductsApi.upload(id, file, options.reason);
    },
    retry: false,
  });
  const submit = useMutation<ApiResult<RegistrantProduct>, unknown, string>({
    mutationFn: (id) => {
      if (mode === PRODUCT_WORKSPACE_MODE.OWNER) return myProductsApi.submit(id);
      if (!options.reason?.trim()) throw new Error('Nhập lý do thao tác trước khi nộp hồ sơ.');
      return adminProductsApi.submit(id, options.reason);
    },
    retry: false,
  });

  return {
    create: (payload) => create.mutateAsync(payload),
    update: (id, payload) => update.mutateAsync({ id, payload }),
    upload: (id, file) => upload.mutateAsync({ id, file }),
    submit: (id) => submit.mutateAsync(id),
    detail: async (id) => {
      if (mode === PRODUCT_WORKSPACE_MODE.OWNER) return myProductsApi.detail(id);
      const result = await adminProductsApi.detail(id);
      return { ...result, data: result.data as unknown as RegistrantProduct };
    },
  };
}

export function invalidateProductDraftQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  mode: typeof PRODUCT_WORKSPACE_MODE.OWNER | typeof PRODUCT_WORKSPACE_MODE.ADMIN,
  options?: { submitted?: boolean },
) {
  invalidateDraftViews(queryClient, mode);
  if (options?.submitted) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.judge.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicProducts.all });
  }
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
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.judge.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.publicProducts.all });
  };
  const submit = useMutation({
    mutationFn: (reason: string) => adminProductsApi.submit(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã nộp hồ sơ thay người đăng ký.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const remove = useMutation({
    mutationFn: (reason: string) => adminProductsApi.remove(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã xóa bản nháp hồ sơ.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const removeAttachment = useMutation({
    mutationFn: ({ attachmentId, reason }: { attachmentId: string; reason: string }) =>
      adminProductsApi.removeAttachment(id, attachmentId, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã xóa tệp đính kèm.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const approve = useMutation({
    mutationFn: (reason?: string) => adminProductsApi.approve(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã duyệt hồ sơ và tự động phân công giám khảo theo cơ quan quản lý.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const returnProduct = useMutation({
    mutationFn: (reason: string) => adminProductsApi.returnProduct(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã trả lại hồ sơ cho người đăng ký.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const publishResults = useMutation({
    mutationFn: (reason?: string) => adminProductsApi.publishResults(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã công bố kết quả chấm điểm cho người đăng ký.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const reopen = useMutation({
    mutationFn: (reason: string) => adminProductsApi.reopen(id, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã mở lại hồ sơ để tiếp tục phân công/chấm điểm.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const addAssignment = useMutation({
    mutationFn: (data: { judgeId: string; reason?: string; confirmRestore?: boolean }) =>
      adminProductsApi.addAssignment(id, data),
    onSuccess: (res) => {
      invalidate();
      if (!('requiresRestoreConfirmation' in res.data && res.data.requiresRestoreConfirmation)) {
        toast.success('Đã cập nhật phân công giám khảo.');
      }
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const removeAssignment = useMutation({
    mutationFn: ({ judgeId, reason }: { judgeId: string; reason?: string }) =>
      adminProductsApi.removeAssignment(id, judgeId, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã gỡ giám khảo khỏi hồ sơ.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });
  const reopenEvaluation = useMutation({
    mutationFn: ({ evaluationId, reason }: { evaluationId: string; reason?: string }) =>
      adminProductsApi.reopenEvaluation(id, evaluationId, reason),
    onSuccess: () => {
      invalidate();
      toast.success('Đã mở lại phiếu chấm để giám khảo chỉnh sửa.');
    },
    onError: (err) => toast.error(messageOf(err)),
    retry: false,
  });

  return {
    submit: (reason: string) => submit.mutateAsync(reason),
    remove: (reason: string) => remove.mutateAsync(reason),
    removeAttachment: (attachmentId: string, reason: string) =>
      removeAttachment.mutateAsync({ attachmentId, reason }),
    approve: (reason?: string) => approve.mutateAsync(reason),
    returnProduct: (reason: string) => returnProduct.mutateAsync(reason),
    publishResults: (reason?: string) => publishResults.mutateAsync(reason),
    reopen: (reason: string) => reopen.mutateAsync(reason),
    addAssignment: (data: { judgeId: string; reason?: string; confirmRestore?: boolean }) =>
      addAssignment.mutateAsync(data),
    removeAssignment: (judgeId: string, reason?: string) =>
      removeAssignment.mutateAsync({ judgeId, reason }),
    reopenEvaluation: (evaluationId: string, reason?: string) =>
      reopenEvaluation.mutateAsync({ evaluationId, reason }),
  };
}

function invalidateDraftViews(
  queryClient: ReturnType<typeof useQueryClient>,
  mode: typeof PRODUCT_WORKSPACE_MODE.OWNER | typeof PRODUCT_WORKSPACE_MODE.ADMIN,
) {
  void queryClient.invalidateQueries({
    queryKey:
      mode === PRODUCT_WORKSPACE_MODE.OWNER
        ? queryKeys.myProducts.all
        : queryKeys.adminProducts.all,
  });
}

export function asRegistrantProduct(detail: AdminProductDetail): RegistrantProduct {
  return detail as unknown as RegistrantProduct;
}
