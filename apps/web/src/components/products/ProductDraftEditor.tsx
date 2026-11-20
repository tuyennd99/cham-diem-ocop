import { useEffect, useMemo, useRef, useState } from 'react';
import type { AdminUserRecord, LocalityRecord } from '@ocop/shared';
import { useSelector } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import {
  Building2,
  CheckCircle2,
  FileUp,
  Film,
  MapPin,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import AlertError from '@/components/alert-error';
import { useAppForm } from '@/components/form';
import { FormField } from '@/components/form-field';
import { ImagePreviewDialog, type ImagePreviewItem } from '@/components/image-preview-dialog';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import {
  FileUpload,
  FileUploadClear,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { myRegistrationUnitsApi } from '../../api';
import {
  ALL,
  ATTACHMENT_TYPE,
  DRAFT_SAVE_RESULT_KIND,
  PRODUCT_REGISTRATION_TYPE,
  PRODUCT_STATUS,
  PRODUCT_WORKSPACE_MODE,
  STAFF_PERMISSION,
} from '../../constants/consts';
import { queryKeys } from '../../constants/query-key';
import { FilterPanel, PageContainer, PageHeader, PageSection } from '../../layouts';
import { toAdminProductApiQuery, type AdminProductSearch } from '../../lib/admin-search';
import { ADMINISTRATIVE_PROVINCES, useWardsByProvince } from '../../lib/administrative-divisions';
import { ApiError, messageOf } from '../../lib/api-error';
import {
  isVideoFileName,
  MAX_PRODUCT_FILE_BYTES,
  MAX_PRODUCT_FILES,
  MAX_PRODUCT_VIDEO_BYTES,
  MAX_PRODUCT_VIDEOS,
  PRODUCT_DOCUMENT_IMAGE_ACCEPT,
  PRODUCT_VIDEO_ACCEPT,
  validateProductFile,
} from '../../lib/attachments';
import { useSession } from '../../lib/auth';
import {
  productEditorCategories,
  type ProductEditorCategory,
} from '../../lib/product-editor-categories';
import {
  applyRegistrationUnitToEditorValues,
  hasEnteredUnitDataToConfirm,
  QUICK_SAVE_UNIT_OUTCOME,
  quickSaveRegistrationUnitAfterDraft,
} from '../../lib/registration-units';
import {
  canStartProductDraftSave,
  getFirstInvalidProductDraftElementId,
  getProductDraftFieldErrors,
  getProductSubmitValidationIssues,
  getUnsavedPrefilledDraftFields,
  saveProductDraft,
} from '../../lib/save-product-draft';
import { hasStaffPermission } from '../../lib/session-contract';
import {
  invalidateProductDraftQueries,
  useAdminProductDetail,
  useProductDraftCommands,
} from '../../queries/admin-products';
import { useRegistrantOwners } from '../../queries/admin-users';
import { useCategories, useLocalities } from '../../queries/common';
import { useMyProduct, useMyRegistrationUnits } from '../../queries/registrant';
import type {
  RegistrantProduct as Product,
  RegistrantFormData as RegistrationFormData,
} from '../../types/registrant';
import { DraftSavedAttachmentsSection } from './draft-editor/DraftSavedAttachmentsSection';
import { DraftSummaryAside } from './draft-editor/DraftSummaryAside';

interface ProductEditorFormValues extends RegistrationFormData {
  name: string;
  description: string;
  categoryId: string;
  localityId: string;
  localityName: string;
  localityCode: string;
}

export interface ProductDraftEditorProps {
  mode: typeof PRODUCT_WORKSPACE_MODE.OWNER | typeof PRODUCT_WORKSPACE_MODE.ADMIN;
  productId?: string;
  returnSearch?: AdminProductSearch;
}

interface EditorBaselineSnapshot {
  values: ProductEditorFormValues;
  registrantId: string;
  reason: string;
}

const currentYear = String(new Date().getFullYear());

const emptyEditorValues: ProductEditorFormValues = {
  name: '',
  description: '',
  categoryId: '',
  localityId: '',
  localityName: '',
  localityCode: '',
  entityName: '',
  representativeName: '',
  representativeTitle: '',
  contactAddress: '',
  provinceName: '',
  phone: '',
  email: '',
  registrationType: '',
  sampleQuantity: '1',
  assessmentYear: currentYear,
  declarationAccepted: false,
};

const validRegistrationTypes = new Set<RegistrationFormData['registrationType']>([
  PRODUCT_REGISTRATION_TYPE.FIRST,
  PRODUCT_REGISTRATION_TYPE.UPGRADE,
  PRODUCT_REGISTRATION_TYPE.REASSESSMENT,
]);

function asText(value: unknown): string {
  return value == null ? '' : String(value);
}

function toEditorValues(
  product: Product,
  accountDefaults?: { phone?: string | null; email?: string | null },
): ProductEditorFormValues {
  const saved = product.formData ?? {};
  const rawType = asText(saved.registrationType) as RegistrationFormData['registrationType'];
  const savedPhone = asText(saved.phone);
  const savedEmail = asText(saved.email);
  const savedProvince = asText(saved.provinceName) || (product.locality?.provinceName ?? '');
  const savedLocalityName = asText(saved.localityName) || (product.locality?.name ?? '');
  const savedLocalityCode = asText(saved.localityCode) || (product.locality?.code ?? '');
  return {
    name: product.name,
    description: product.description ?? '',
    categoryId: product.category.id,
    localityId: product.localityId ?? '',
    localityName: savedLocalityName,
    localityCode: savedLocalityCode,
    entityName: asText(saved.entityName),
    representativeName: asText(saved.representativeName),
    representativeTitle: asText(saved.representativeTitle),
    contactAddress: asText(saved.contactAddress),
    provinceName: savedProvince,
    phone: savedPhone || (accountDefaults?.phone ?? ''),
    email: savedEmail || (accountDefaults?.email ?? ''),
    registrationType: validRegistrationTypes.has(rawType) ? rawType : '',
    sampleQuantity: saved.sampleQuantity == null ? '' : asText(saved.sampleQuantity),
    assessmentYear: saved.assessmentYear == null ? currentYear : asText(saved.assessmentYear),
    declarationAccepted: saved.declarationAccepted === true,
  };
}

function areEditorValuesEqual(a: ProductEditorFormValues, b: ProductEditorFormValues): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.categoryId === b.categoryId &&
    a.localityId === b.localityId &&
    a.localityName === b.localityName &&
    a.localityCode === b.localityCode &&
    a.entityName === b.entityName &&
    a.representativeName === b.representativeName &&
    a.representativeTitle === b.representativeTitle &&
    a.contactAddress === b.contactAddress &&
    a.provinceName === b.provinceName &&
    a.phone === b.phone &&
    a.email === b.email &&
    a.registrationType === b.registrationType &&
    a.sampleQuantity === b.sampleQuantity &&
    a.assessmentYear === b.assessmentYear &&
    a.declarationAccepted === b.declarationAccepted
  );
}

const unitTextFields: Array<{
  name: 'entityName' | 'representativeName' | 'representativeTitle' | 'phone' | 'email';
  label: string;
  maxLength: number;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}> = [
  {
    name: 'entityName',
    label: 'Tên đơn vị sản xuất',
    maxLength: 255,
    placeholder: 'Nhập tên đầy đủ của chủ thể / đơn vị sản xuất',
    required: true,
  },
  {
    name: 'representativeName',
    label: 'Người đại diện',
    maxLength: 255,
    placeholder: 'Nhập họ và tên người đại diện pháp luật',
    required: true,
  },
  {
    name: 'representativeTitle',
    label: 'Chức vụ người đại diện',
    maxLength: 255,
    placeholder: 'VD: Giám đốc, Chủ cơ sở…',
    required: true,
  },
  {
    name: 'phone',
    label: 'Số điện thoại',
    maxLength: 30,
    type: 'tel',
    autoComplete: 'tel',
    placeholder: 'VD: 0901 234 567',
  },
  {
    name: 'email',
    label: 'Email',
    maxLength: 320,
    type: 'email',
    autoComplete: 'email',
    placeholder: 'VD: lienhe@donvi.vn',
    disabled: true,
  },
];

export function ProductDraftEditor({ mode, productId, returnSearch }: ProductDraftEditorProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, STAFF_PERMISSION.MANAGE);
  const listReturnSearch = returnSearch ? toAdminProductApiQuery(returnSearch) : undefined;
  const categoryQuery = useCategories();
  const ownerProductQuery = useMyProduct(
    mode === PRODUCT_WORKSPACE_MODE.OWNER ? productId : undefined,
  );
  const registrationUnitsQuery = useMyRegistrationUnits(mode === PRODUCT_WORKSPACE_MODE.OWNER);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [saveUnitToSettings, setSaveUnitToSettings] = useState(false);
  const [unitSaveNotice, setUnitSaveNotice] = useState('');
  const adminProductQuery = useAdminProductDetail(
    PRODUCT_WORKSPACE_MODE.REGISTRATIONS,
    canManage,
    mode === PRODUCT_WORKSPACE_MODE.ADMIN ? (productId ?? '') : '',
  );
  const queryProduct =
    mode === PRODUCT_WORKSPACE_MODE.OWNER
      ? ownerProductQuery.data
      : (adminProductQuery.data?.data as Product | undefined);
  const productError =
    mode === PRODUCT_WORKSPACE_MODE.OWNER ? ownerProductQuery.error : adminProductQuery.error;
  const productPending =
    Boolean(productId) &&
    (mode === PRODUCT_WORKSPACE_MODE.OWNER
      ? ownerProductQuery.isPending
      : adminProductQuery.isPending);
  const [selectedProvince, setSelectedProvince] = useState('');
  const localityQuery = useLocalities(
    {
      page: 1,
      limit: 100,
      provinceName: selectedProvince || undefined,
    },
    Boolean(selectedProvince),
  );
  const [categories, setCategories] = useState<ProductEditorCategory[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const defaultPhone = mode === PRODUCT_WORKSPACE_MODE.OWNER ? (session?.user.phone ?? '') : '';
  const defaultEmail =
    mode === PRODUCT_WORKSPACE_MODE.OWNER
      ? (session?.user.email ?? '')
      : (adminProductQuery.data?.data.registrant.email ?? '');
  const firstCategoryId = categoryQuery.data?.[0]?.id ?? '';
  const [baselineValues, setBaselineValues] = useState<ProductEditorFormValues>(() => ({
    ...emptyEditorValues,
    categoryId: firstCategoryId,
    phone: defaultPhone,
    email: defaultEmail,
  }));
  const createStarted = useRef(false);
  const savedNavigation = useRef(false);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const submitIntentRef = useRef<'draft' | 'submit'>('draft');
  const [activeSubmitIntent, setActiveSubmitIntent] = useState<'draft' | 'submit'>('draft');
  const initializedKeyRef = useRef<string | null>(null);
  const baselineRef = useRef<EditorBaselineSnapshot>({
    values: baselineValues,
    registrantId: '',
    reason: '',
  });
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [uploadFailureId, setUploadFailureId] = useState('');
  const [createOutcomeUnknown, setCreateOutcomeUnknown] = useState(false);
  const [reason, setReason] = useState('');
  const [registrantId, setRegistrantId] = useState('');
  const [selectedRegistrant, setSelectedRegistrant] = useState<AdminUserRecord | null>(null);
  const [registrantSearch, setRegistrantSearch] = useState('');
  const [registrantPage, setRegistrantPage] = useState(1);
  const registrantLookup = useRegistrantOwners(
    { page: registrantPage, limit: 20, q: registrantSearch || undefined },
    mode === PRODUCT_WORKSPACE_MODE.ADMIN && canManage && !productId,
  );
  const commands = useProductDraftCommands(mode, { registrantId, reason });

  const form = useAppForm({
    defaultValues: baselineValues,
    onSubmit: async ({ value }) => {
      if (
        submittingRef.current ||
        !canStartProductDraftSave({
          reviewRequired,
          createOutcomeUnknown,
        })
      )
        return;
      setError('');
      setValidationErrors([]);
      setUnitSaveNotice('');
      createStarted.current = false;
      setCreateOutcomeUnknown(false);
      setUploadFailureId('');
      const submitAfterSave = submitIntentRef.current === 'submit';
      const shouldSaveUnit =
        mode === PRODUCT_WORKSPACE_MODE.OWNER && saveUnitToSettings && !selectedUnitId;
      const wasReturned = product?.status === PRODUCT_STATUS.RETURNED;
      const hadExistingProduct = Boolean(product);
      let latestSavedProduct: Product | null = product;
      let uploadedCount = 0;
      submittingRef.current = true;
      setSubmitting(true);
      try {
        const selectedFiles = [...files, ...videoFiles];
        if (mode === PRODUCT_WORKSPACE_MODE.ADMIN && !product && !registrantId) {
          throw new Error('Chọn người đăng ký trước khi lưu hồ sơ.');
        }
        if (mode === PRODUCT_WORKSPACE_MODE.ADMIN && !reason.trim()) {
          throw new Error('Nhập lý do thao tác trước khi lưu hồ sơ.');
        }
        const categoryUnavailable =
          submitAfterSave &&
          categories.some((item) => item.id === value.categoryId && item.unavailable);
        const intent = submitAfterSave ? 'submit' : 'draft';
        const fieldErrors = getProductDraftFieldErrors(
          {
            ...value,
            categoryUnavailable,
          },
          { intent },
        );
        const submitIssues = getProductSubmitValidationIssues(
          {
            ...value,
            categoryUnavailable,
          },
          { intent },
        );
        if (submitIssues.length > 0) {
          setHasAttemptedSubmit(true);
          setValidationErrors(submitIssues);
          setError(submitIssues[0]);
          toast.error(submitIssues[0]);
          const firstInvalidId = getFirstInvalidProductDraftElementId(fieldErrors);
          if (firstInvalidId && typeof document !== 'undefined') {
            requestAnimationFrame(() => {
              const targetEl = document.getElementById(firstInvalidId);
              if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.focus({ preventScroll: true });
              }
            });
          }
          return;
        }
        setHasAttemptedSubmit(false);
        const sampleQuantity = Number(value.sampleQuantity.trim());
        const assessmentYear = Number(value.assessmentYear.trim());
        const {
          name: _omitName,
          description: _omitDescription,
          categoryId: _omitCategoryId,
          localityId: _omitLocalityId,
          ...registrationFields
        } = value;
        const formData = {
          ...registrationFields,
          localityName: value.localityName?.trim() || undefined,
          localityCode: value.localityCode?.trim() || undefined,
          registrationType: value.registrationType || undefined,
          sampleQuantity,
          assessmentYear,
        };
        const payload = {
          name: value.name,
          description: value.description,
          categoryId: value.categoryId,
          localityId: value.localityId || null,
          formData,
        };
        const saveCommands = {
          ...commands,
          create: (data: typeof payload) => {
            createStarted.current = true;
            return commands.create(data);
          },
          upload: async (id: string, file: File) => {
            const uploaded = await commands.upload(id, file);
            uploadedCount += 1;
            return uploaded;
          },
        };
        const result = await saveProductDraft({
          existingProduct: product ?? undefined,
          payload,
          files: selectedFiles,
          commands: saveCommands,
          submitAfterSave,
          onDraftSaved: (saved) => {
            latestSavedProduct = saved;
            if (saved.status === PRODUCT_STATUS.DRAFT || saved.status === PRODUCT_STATUS.RETURNED) {
              setProduct(saved);
            }
          },
        });
        if (result.kind === DRAFT_SAVE_RESULT_KIND.UPLOAD_FAILED) {
          setProduct(result.product);
          setReviewRequired(result.requiresReview);
          setUploadFailureId(result.product.id);
          setFiles(result.remainingFiles.filter((file) => !isVideoFileName(file.name)));
          setVideoFiles(result.remainingFiles.filter((file) => isVideoFileName(file.name)));
          setBaselineValues(value);
          baselineRef.current = {
            values: value,
            registrantId,
            reason,
          };
          invalidateProductDraftQueries(queryClient, mode);
          setError(result.message);
          toast.error(result.message);
          return;
        }

        const unitSaveResult = await quickSaveRegistrationUnitAfterDraft({
          enabled: shouldSaveUnit,
          values: value,
          createUnit: (unitPayload) => myRegistrationUnitsApi.create(unitPayload),
        });

        const isSubmittedResult = result.kind === DRAFT_SAVE_RESULT_KIND.SUBMITTED;

        if (unitSaveResult.kind === QUICK_SAVE_UNIT_OUTCOME.SAVED) {
          setSelectedUnitId(unitSaveResult.nextSelectedUnitId);
          setSaveUnitToSettings(false);
          await queryClient.invalidateQueries({
            queryKey: queryKeys.myRegistrationUnits.all,
          });
          toast.success(
            isSubmittedResult
              ? wasReturned
                ? 'Đã nộp lại hồ sơ sản phẩm và lưu đơn vị vào Cấu hình chung.'
                : 'Đã lưu, nộp hồ sơ sản phẩm và lưu đơn vị vào Cấu hình chung.'
              : hadExistingProduct
                ? 'Đã cập nhật hồ sơ sản phẩm và lưu đơn vị vào Cấu hình chung.'
                : 'Đã tạo hồ sơ sản phẩm mới và lưu đơn vị vào Cấu hình chung.',
          );
        } else if (unitSaveResult.kind !== QUICK_SAVE_UNIT_OUTCOME.SKIPPED) {
          setSaveUnitToSettings(unitSaveResult.nextSaveUnitToSettings);
          setUnitSaveNotice(unitSaveResult.message);
          if (unitSaveResult.kind === QUICK_SAVE_UNIT_OUTCOME.UNKNOWN) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.myRegistrationUnits.all,
            });
          }
          if (isSubmittedResult) {
            toast.warning(
              unitSaveResult.message.replace(
                /^Đã lưu hồ sơ sản phẩm nháp/,
                wasReturned ? 'Đã nộp lại hồ sơ sản phẩm' : 'Đã nộp hồ sơ sản phẩm',
              ),
            );
          } else {
            setProduct(result.product);
            setReviewRequired(false);
            setFiles([]);
            setVideoFiles([]);
            setBaselineValues(value);
            baselineRef.current = {
              values: value,
              registrantId,
              reason,
            };
            invalidateProductDraftQueries(queryClient, mode);
            setError(unitSaveResult.message);
            toast.error(unitSaveResult.message);
            return;
          }
        } else {
          toast.success(
            isSubmittedResult
              ? mode === PRODUCT_WORKSPACE_MODE.ADMIN
                ? 'Đã lưu và nộp hồ sơ thay người đăng ký.'
                : wasReturned
                  ? 'Đã lưu và nộp lại hồ sơ sản phẩm.'
                  : 'Đã lưu và nộp hồ sơ sản phẩm.'
              : hadExistingProduct
                ? 'Đã cập nhật hồ sơ sản phẩm.'
                : 'Đã tạo hồ sơ sản phẩm mới.',
          );
        }

        if (mode === PRODUCT_WORKSPACE_MODE.OWNER) {
          queryClient.setQueryData(queryKeys.myProducts.detail(result.product.id), result.product);
        }
        invalidateProductDraftQueries(queryClient, mode, { submitted: isSubmittedResult });

        savedNavigation.current = true;
        try {
          if (mode === PRODUCT_WORKSPACE_MODE.OWNER) {
            await navigate({ to: '/my/products/$id', params: { id: result.product.id } });
          } else {
            await navigate({
              to: '/admin/registrations/$id',
              params: { id: result.product.id },
              search: listReturnSearch,
            });
          }
        } finally {
          savedNavigation.current = false;
        }
      } catch (cause) {
        if (latestSavedProduct) {
          if (
            latestSavedProduct.status === PRODUCT_STATUS.DRAFT ||
            latestSavedProduct.status === PRODUCT_STATUS.RETURNED
          ) {
            setProduct(latestSavedProduct);
          }
          if (uploadedCount > 0) {
            const remaining = [...files, ...videoFiles].slice(uploadedCount);
            setFiles(remaining.filter((file) => !isVideoFileName(file.name)));
            setVideoFiles(remaining.filter((file) => isVideoFileName(file.name)));
          }
          setBaselineValues(value);
          baselineRef.current = {
            values: value,
            registrantId,
            reason,
          };
          invalidateProductDraftQueries(queryClient, mode);
        }
        const unknownCreate =
          createStarted.current &&
          !latestSavedProduct &&
          !(cause instanceof ApiError && cause.status < 500);
        setCreateOutcomeUnknown(unknownCreate);
        const errMsg = unknownCreate
          ? `${messageOf(cause)} Chưa rõ hồ sơ đã được tạo chưa; kiểm tra danh sách trước khi tạo lại.`
          : messageOf(cause);
        setError(errMsg);
        toast.error(errMsg);
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
  });

  const isFormSubmitting = useSelector(form.store, (state) => state.isSubmitting);
  const busy = isFormSubmitting || submitting;
  const currentValues = useSelector(form.store, (state) => state.values);
  const staticWardsInProvince = useWardsByProvince(currentValues.provinceName);
  const dirty =
    loaded &&
    (!areEditorValuesEqual(currentValues, baselineValues) ||
      files.length > 0 ||
      videoFiles.length > 0 ||
      (mode === PRODUCT_WORKSPACE_MODE.ADMIN &&
        (registrantId !== baselineRef.current.registrantId ||
          reason !== baselineRef.current.reason)));

  useBlocker({
    shouldBlockFn: () =>
      !savedNavigation.current &&
      !submittingRef.current &&
      dirty &&
      !window.confirm('Hồ sơ có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
    enableBeforeUnload: () => dirty && !savedNavigation.current && !submittingRef.current,
  });

  useEffect(() => {
    if (submittingRef.current || savedNavigation.current) {
      return;
    }
    if (categoryQuery.isPending || productPending) {
      setLoaded(false);
      return;
    }
    setLoaded(true);
    setError('');
    const loadError = productError ?? categoryQuery.error;
    if (loadError) {
      setError(messageOf(loadError));
      return;
    }
    const activeCategories = categoryQuery.data ?? [];
    const current = queryProduct ?? null;
    if (productId) {
      setProduct(current);
    }
    setCategories(productEditorCategories(activeCategories, current ?? product));

    const sourceKey = productId ? `edit:${productId}:${current?.id ?? ''}` : 'new';
    if (initializedKeyRef.current === sourceKey) {
      if (!productId) {
        const currentFormValues = form.state.values;
        const defaultedPatch: Partial<ProductEditorFormValues> = {};
        if (!currentFormValues.categoryId && activeCategories[0]?.id) {
          form.setFieldValue('categoryId', activeCategories[0].id, { dontUpdateMeta: true });
          defaultedPatch.categoryId = activeCategories[0].id;
        }
        if (!currentFormValues.phone && defaultPhone) {
          form.setFieldValue('phone', defaultPhone, { dontUpdateMeta: true });
          defaultedPatch.phone = defaultPhone;
        }
        if (!currentFormValues.email && defaultEmail) {
          form.setFieldValue('email', defaultEmail, { dontUpdateMeta: true });
          defaultedPatch.email = defaultEmail;
        }
        if (Object.keys(defaultedPatch).length > 0 && !form.state.isTouched) {
          setBaselineValues((prev) => {
            const nextBaseline = { ...prev, ...defaultedPatch };
            baselineRef.current = { ...baselineRef.current, values: nextBaseline };
            return nextBaseline;
          });
        }
      }
      return;
    }
    initializedKeyRef.current = sourceKey;
    setSelectedUnitId('');
    setSaveUnitToSettings(false);
    setUnitSaveNotice('');

    if (current) {
      const nextValues = toEditorValues(current, {
        phone: defaultPhone,
        email: defaultEmail,
      });
      setBaselineValues(nextValues);
      baselineRef.current = {
        values: nextValues,
        registrantId: '',
        reason: '',
      };
      form.reset(nextValues);
      setSelectedProvince(nextValues.provinceName);
    } else if (!productId) {
      const nextValues = {
        ...emptyEditorValues,
        categoryId: activeCategories[0]?.id ?? '',
        phone: defaultPhone,
        email: defaultEmail,
      };
      setBaselineValues(nextValues);
      baselineRef.current = {
        values: nextValues,
        registrantId: '',
        reason: '',
      };
      form.reset(nextValues);
      setSelectedProvince('');
    }
  }, [
    categoryQuery.data,
    categoryQuery.error,
    categoryQuery.isPending,
    defaultEmail,
    defaultPhone,
    form,
    product,
    productError,
    productId,
    productPending,
    queryProduct,
  ]);

  const previewItems = useMemo<ImagePreviewItem[]>(() => {
    const list: ImagePreviewItem[] = [];
    if (product) {
      for (const att of product.attachments) {
        if (att.type === ATTACHMENT_TYPE.IMAGE && !isVideoFileName(att.fileName)) {
          list.push({
            kind: 'private',
            id: att.id,
            name: att.fileName,
            mode,
            productId: product.id,
          });
        }
      }
    }
    files.forEach((f, idx) => {
      if (f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
        list.push({
          kind: 'file',
          id: `local-file-${idx}-${f.name}-${f.size}`,
          name: f.name,
          file: f,
        });
      }
    });
    return list;
  }, [files, mode, product]);

  if (productId && !loaded && !error) {
    return (
      <PageContainer className='admin-draft-editor' aria-busy='true'>
        <PageSpin />
      </PageContainer>
    );
  }
  if (productId && loaded && !product) {
    return (
      <PageContainer className='admin-draft-editor'>
        <h1>Không tìm thấy hồ sơ</h1>
        <AlertError
          title='Không tìm thấy hồ sơ'
          errors={[error || 'Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.']}
        />
        {mode === PRODUCT_WORKSPACE_MODE.OWNER ? (
          <Button asChild variant='secondary' className='mt-3'>
            <Link to='/my/products'>Quay lại danh sách</Link>
          </Button>
        ) : (
          <Button asChild variant='secondary' className='mt-3'>
            <Link to='/admin/registrations' search={listReturnSearch}>
              Quay lại danh sách phiếu đăng ký
            </Link>
          </Button>
        )}
      </PageContainer>
    );
  }
  if (
    product &&
    product.status !== PRODUCT_STATUS.DRAFT &&
    product.status !== PRODUCT_STATUS.RETURNED
  ) {
    return (
      <PageContainer className='admin-draft-editor'>
        <h1>Hồ sơ đã nộp</h1>
        <p>Hồ sơ không còn ở trạng thái bản nháp hoặc bị trả lại nên không thể sửa.</p>
        {mode === PRODUCT_WORKSPACE_MODE.OWNER ? (
          <Button asChild variant='secondary' className='mt-3'>
            <Link to='/my/products/$id' params={{ id: product.id }}>
              Quay lại hồ sơ
            </Link>
          </Button>
        ) : (
          <Button asChild variant='secondary' className='mt-3'>
            <Link to='/admin/registrations/$id' params={{ id: product.id }} search={returnSearch}>
              Quay lại hồ sơ
            </Link>
          </Button>
        )}
      </PageContainer>
    );
  }

  const localityOptions: LocalityRecord[] = localityQuery.data?.data ?? [];
  const registrantTotalPages = registrantLookup.data?.meta?.totalPages ?? 0;
  const localityIdsByName = new Map(
    localityOptions.map((loc) => [loc.name.trim().toLowerCase(), loc]),
  );

  const backLink =
    mode === PRODUCT_WORKSPACE_MODE.ADMIN ? (
      <Link
        className='text-link text-sm'
        to={product ? '/admin/registrations/$id' : '/admin/registrations'}
        params={product ? { id: product.id } : undefined}
        search={product ? returnSearch : listReturnSearch}
      >
        ← {product ? 'Quay lại chi tiết phiếu' : 'Quay lại danh sách phiếu đăng ký'}
      </Link>
    ) : (
      <Link
        className='text-link text-sm'
        to={product ? '/my/products/$id' : '/my/products'}
        params={product ? { id: product.id } : undefined}
      >
        ← {product ? 'Quay lại chi tiết hồ sơ' : 'Quay lại danh sách hồ sơ'}
      </Link>
    );

  const selectedLocalityObj =
    localityOptions.find(({ id }) => id === currentValues.localityId) ??
    (product?.localityId === currentValues.localityId ? product?.locality : null);
  const selectedLocalityDisplay = selectedLocalityObj
    ? `${selectedLocalityObj.name} · ${selectedLocalityObj.provinceName}`
    : currentValues.localityName && currentValues.provinceName
      ? `${currentValues.localityName} · ${currentValues.provinceName}`
      : null;
  const selectedCategoryObj = categories.find(({ id }) => id === currentValues.categoryId);
  const liveFieldErrors = hasAttemptedSubmit
    ? getProductDraftFieldErrors(
        {
          ...currentValues,
          categoryUnavailable:
            activeSubmitIntent === 'submit' && Boolean(selectedCategoryObj?.unavailable),
        },
        { intent: activeSubmitIntent },
      )
    : {};
  const unsavedPrefilledFields = product
    ? getUnsavedPrefilledDraftFields(product.formData, currentValues, product.localityId)
    : [];
  const hasCompleteLocality =
    Boolean(currentValues.provinceName.trim()) &&
    Boolean(currentValues.localityId || currentValues.localityName.trim());
  const savedAttachments = product?.attachments ?? [];
  const savedVideoCount = savedAttachments.filter((att) => isVideoFileName(att.fileName)).length;
  const savedFileCount = savedAttachments.length - savedVideoCount;
  const remainingFileSlots = Math.max(0, MAX_PRODUCT_FILES - savedFileCount);
  const remainingVideoSlots = Math.max(0, MAX_PRODUCT_VIDEOS - savedVideoCount);
  const totalRegularFilesCount = savedFileCount + files.length;
  const totalVideoFilesCount = savedVideoCount + videoFiles.length;

  const currentComboValue = currentValues.localityId
    ? currentValues.localityId
    : currentValues.localityName
      ? `ward-name:${currentValues.localityName}`
      : ALL;

  const fallbackTitle =
    mode === PRODUCT_WORKSPACE_MODE.ADMIN
      ? productId
        ? 'Sửa phiếu đăng ký'
        : 'Nhập phiếu đăng ký'
      : productId
        ? product?.status === PRODUCT_STATUS.RETURNED
          ? 'Chỉnh sửa hồ sơ bị trả lại'
          : 'Sửa hồ sơ nháp'
        : 'Tạo hồ sơ sản phẩm';
  const pageTitle = productId
    ? currentValues.name.trim() || product?.name || fallbackTitle
    : fallbackTitle;

  return (
    <PageContainer className='admin-draft-editor'>
      <PageHeader
        backLink={backLink}
        title={pageTitle}
        badge={
          <Badge
            variant={product?.status === PRODUCT_STATUS.RETURNED ? 'destructive' : 'secondary'}
          >
            {product?.status === PRODUCT_STATUS.RETURNED ? 'Bị trả lại' : 'Bản nháp'}
          </Badge>
        }
      />

      {product?.status === PRODUCT_STATUS.RETURNED && product.returnReason && (
        <div
          role='alert'
          className='border-destructive/40 bg-destructive/10 mb-4 rounded-lg border p-4 text-sm'
        >
          <p className='text-destructive font-semibold'>Lý do trả lại từ Chủ trì / Quản trị:</p>
          <p className='mt-1'>{product.returnReason}</p>
        </div>
      )}

      {mode === PRODUCT_WORKSPACE_MODE.ADMIN && (
        <FilterPanel className='draft-admin-context-card'>
          <div className='draft-step-header'>
            <div>
              <h2>Ngữ cảnh thao tác quản trị</h2>
              <p className='draft-step-subtitle'>
                Xác định chủ thể sở hữu hồ sơ và ghi rõ lý do tạo/chỉnh sửa thay người đăng ký.
              </p>
            </div>
            <Badge variant='secondary'>Quản trị viên</Badge>
          </div>
          <div className='admin-step-grid'>
            {!product ? (
              <div className='draft-lookup-box admin-step-span-2'>
                <div className='draft-lookup-header'>
                  <div className='draft-lookup-title'>
                    <Building2 className='size-4' aria-hidden='true' />
                    <span>Chủ thể đăng ký sở hữu hồ sơ</span>
                  </div>
                  <div className='draft-lookup-pager'>
                    <Button
                      variant='secondary'
                      size='sm'
                      type='button'
                      disabled={busy || registrantPage <= 1 || registrantLookup.isPending}
                      onClick={() => setRegistrantPage((page) => Math.max(1, page - 1))}
                    >
                      Trước
                    </Button>
                    <span className='draft-lookup-page-label'>
                      {registrantTotalPages > 0
                        ? `Trang ${registrantPage}/${registrantTotalPages}`
                        : '0 kết quả'}
                    </span>
                    <Button
                      variant='secondary'
                      size='sm'
                      type='button'
                      disabled={
                        busy ||
                        registrantLookup.isPending ||
                        registrantTotalPages === 0 ||
                        registrantPage >= registrantTotalPages
                      }
                      onClick={() => setRegistrantPage((page) => page + 1)}
                    >
                      Sau
                    </Button>
                  </div>
                </div>
                <div className='draft-lookup-grid draft-lookup-grid--admin'>
                  <FormField
                    label='Tìm người đăng ký đã xác minh (tên hoặc email)'
                    htmlFor='admin-draft-registrant-search'
                  >
                    <Input
                      id='admin-draft-registrant-search'
                      value={registrantSearch}
                      disabled={busy}
                      onChange={(event) => {
                        setRegistrantSearch(event.target.value);
                        setRegistrantPage(1);
                      }}
                      maxLength={100}
                      placeholder='Nhập tên hoặc email người đăng ký…'
                    />
                  </FormField>
                  <FormField
                    label='Chọn người đăng ký'
                    htmlFor='admin-draft-registrant-select'
                    required
                  >
                    <Combobox
                      value={registrantId || ALL}
                      disabled={busy}
                      onValueChange={(value) => {
                        const nextId = value === ALL ? '' : value;
                        const selected =
                          registrantLookup.data?.data.find(({ id }) => id === nextId) ?? null;
                        setRegistrantId(nextId);
                        setSelectedRegistrant(selected);
                        if (selected) {
                          form.setFieldValue('phone', selected.phone ?? '');
                          form.setFieldValue('email', selected.email ?? '');
                        }
                      }}
                    >
                      <ComboboxAnchor>
                        <ComboboxInput
                          id='admin-draft-registrant-select'
                          placeholder='Chọn người đăng ký'
                        />
                        <ComboboxTrigger />
                      </ComboboxAnchor>
                      <ComboboxContent>
                        <ComboboxEmpty>Không tìm thấy người đăng ký.</ComboboxEmpty>
                        <ComboboxItem value={ALL}>Chọn người đăng ký</ComboboxItem>
                        {selectedRegistrant &&
                          !registrantLookup.data?.data.some(
                            ({ id }) => id === selectedRegistrant.id,
                          ) && (
                            <ComboboxItem value={selectedRegistrant.id}>
                              {selectedRegistrant.fullName} · {selectedRegistrant.email}
                            </ComboboxItem>
                          )}
                        {registrantLookup.data?.data.map((owner) => (
                          <ComboboxItem key={owner.id} value={owner.id}>
                            {owner.fullName} · {owner.email}
                          </ComboboxItem>
                        ))}
                      </ComboboxContent>
                    </Combobox>
                  </FormField>
                  <FormField label='Lý do thao tác' htmlFor='admin-draft-reason' required>
                    <Input
                      id='admin-draft-reason'
                      value={reason}
                      disabled={busy}
                      maxLength={255}
                      placeholder='Ghi rõ lý do nhập hoặc chỉnh sửa hộ người đăng ký…'
                      onChange={(event) => setReason(event.target.value)}
                      required
                    />
                  </FormField>
                </div>
                {registrantLookup.error && (
                  <AlertError
                    title='Không tải được danh sách người đăng ký'
                    errors={[messageOf(registrantLookup.error)]}
                  />
                )}
              </div>
            ) : (
              <>
                <div>
                  <span className='text-sm font-semibold'>Người đăng ký sở hữu hồ sơ</span>
                  <p className='text-muted mt-1 text-sm'>
                    {adminProductQuery.data?.data.registrant.fullName} ·{' '}
                    {adminProductQuery.data?.data.registrant.email}
                  </p>
                </div>
                <FormField label='Lý do thao tác' htmlFor='admin-draft-reason' required>
                  <Input
                    id='admin-draft-reason'
                    value={reason}
                    disabled={busy}
                    maxLength={255}
                    placeholder='Ghi rõ lý do nhập hoặc chỉnh sửa hộ người đăng ký…'
                    onChange={(event) => setReason(event.target.value)}
                    required
                  />
                </FormField>
              </>
            )}
          </div>
        </FilterPanel>
      )}

      <div className='draft-editor-layout'>
        <div className='draft-editor-main'>
          <form
            id='product-draft-form'
            noValidate
            className='admin-form filter-card draft-form-card'
            onSubmit={(event) => {
              event.preventDefault();
              const submitter = (event.nativeEvent as SubmitEvent)
                .submitter as HTMLButtonElement | null;
              const nextIntent = submitter?.dataset.submitIntent === 'submit' ? 'submit' : 'draft';
              submitIntentRef.current = nextIntent;
              setActiveSubmitIntent(nextIntent);
              void form.handleSubmit();
            }}
          >
            <div className='draft-unified-sections'>
              {/* PHẦN 1: ĐƠN VỊ ĐĂNG KÝ */}
              <section className='draft-form-section' aria-labelledby='draft-section-unit'>
                <div className='draft-step-header'>
                  <div>
                    <h2 id='draft-section-unit'>Đơn vị đăng ký</h2>
                    <p className='draft-step-subtitle'>
                      Khai báo địa bàn hành chính, đơn vị sản xuất và thông tin liên hệ.
                    </p>
                  </div>
                  <span className='draft-step-counter'>Phần 1 / 3</span>
                </div>

                <div
                  className={
                    mode === PRODUCT_WORKSPACE_MODE.OWNER
                      ? 'draft-unit-section-grid draft-unit-section-grid--owner'
                      : 'draft-unit-section-grid draft-unit-section-grid--admin'
                  }
                >
                  {mode === PRODUCT_WORKSPACE_MODE.OWNER && (
                    <div className='draft-lookup-box draft-unit-col draft-unit-col--saved'>
                      <div className='draft-lookup-header'>
                        <div className='draft-lookup-title'>
                          <Building2 className='size-4' aria-hidden='true' />
                          <span>Đơn vị đăng ký trong Cấu hình chung</span>
                        </div>
                        <Link to='/my/settings' className='text-link text-xs'>
                          Quản lý đơn vị đã lưu →
                        </Link>
                      </div>

                      <div className='grid gap-3'>
                        <div data-slot='form-field' className='flex min-w-0 flex-col gap-1.5'>
                          <div className='flex flex-wrap items-center justify-between gap-2'>
                            <Label htmlFor='editor-registration-unit-select'>
                              Chọn đơn vị đã lưu hoặc nhập trực tiếp
                            </Label>
                            {!selectedUnitId && (
                              <div className='flex items-center gap-2'>
                                <Checkbox
                                  id='editor-save-unit-to-settings'
                                  checked={saveUnitToSettings}
                                  disabled={busy}
                                  onCheckedChange={(checked) => {
                                    setSaveUnitToSettings(checked === true);
                                    setUnitSaveNotice('');
                                  }}
                                />
                                <Label
                                  htmlFor='editor-save-unit-to-settings'
                                  className='cursor-pointer text-sm font-medium'
                                >
                                  Lưu đơn vị
                                </Label>
                              </div>
                            )}
                          </div>
                          <Combobox
                            value={selectedUnitId || ALL}
                            disabled={busy || registrationUnitsQuery.isLoading}
                            onValueChange={(value) => {
                              if (value === ALL || !value) {
                                setSelectedUnitId('');
                                setSaveUnitToSettings(false);
                                setUnitSaveNotice('');
                                return;
                              }
                              const unit = registrationUnitsQuery.data?.find(
                                (item) => item.id === value,
                              );
                              if (!unit) return;
                              if (
                                hasEnteredUnitDataToConfirm(currentValues, unit, defaultPhone) &&
                                !window.confirm(
                                  'Thay thế thông tin đơn vị đã nhập bằng thông tin của đơn vị đã chọn?',
                                )
                              ) {
                                return;
                              }
                              const nextValues = applyRegistrationUnitToEditorValues(
                                currentValues,
                                unit,
                              );
                              setSelectedUnitId(unit.id);
                              setSaveUnitToSettings(false);
                              setUnitSaveNotice('');
                              setSelectedProvince(nextValues.provinceName);
                              form.setFieldValue('entityName', nextValues.entityName);
                              form.setFieldValue(
                                'representativeName',
                                nextValues.representativeName,
                              );
                              form.setFieldValue(
                                'representativeTitle',
                                nextValues.representativeTitle,
                              );
                              form.setFieldValue('phone', nextValues.phone);
                              form.setFieldValue('contactAddress', nextValues.contactAddress);
                              form.setFieldValue('provinceName', nextValues.provinceName);
                              form.setFieldValue('localityName', nextValues.localityName);
                              form.setFieldValue('localityCode', nextValues.localityCode);
                              form.setFieldValue('localityId', nextValues.localityId);
                            }}
                          >
                            <ComboboxAnchor>
                              <ComboboxInput
                                id='editor-registration-unit-select'
                                placeholder={
                                  registrationUnitsQuery.isLoading
                                    ? 'Đang tải danh sách đơn vị đã lưu…'
                                    : 'Nhập thông tin đơn vị trực tiếp (nhập tay)'
                                }
                              />
                              <ComboboxTrigger />
                            </ComboboxAnchor>
                            <ComboboxContent>
                              <ComboboxEmpty>Không tìm thấy đơn vị đăng ký phù hợp.</ComboboxEmpty>
                              <ComboboxItem value={ALL}>
                                Nhập thông tin đơn vị trực tiếp (nhập tay)
                              </ComboboxItem>
                              {(registrationUnitsQuery.data ?? []).map((unit) => (
                                <ComboboxItem key={unit.id} value={unit.id}>
                                  {unit.entityName} · {unit.localityName}, {unit.provinceName}
                                </ComboboxItem>
                              ))}
                            </ComboboxContent>
                          </Combobox>
                        </div>

                        {registrationUnitsQuery.error && (
                          <div className='flex items-start gap-2'>
                            <div className='min-w-0 flex-1'>
                              <AlertError
                                title='Không thể tải danh sách đơn vị đã lưu'
                                errors={[messageOf(registrationUnitsQuery.error)]}
                              />
                            </div>
                            <Button
                              type='button'
                              variant='secondary'
                              size='icon-sm'
                              title='Thử tải lại danh sách đơn vị'
                              aria-label='Thử tải lại danh sách đơn vị'
                              disabled={registrationUnitsQuery.isFetching}
                              onClick={() => void registrationUnitsQuery.refetch()}
                            >
                              <RefreshCw
                                className={
                                  registrationUnitsQuery.isFetching
                                    ? 'size-4 animate-spin'
                                    : 'size-4'
                                }
                                aria-hidden='true'
                              />
                            </Button>
                          </div>
                        )}

                        {!registrationUnitsQuery.isLoading &&
                          !registrationUnitsQuery.error &&
                          (registrationUnitsQuery.data?.length ?? 0) === 0 && (
                            <p className='draft-lookup-hint' role='status'>
                              Chưa có đơn vị nào trong Cấu hình chung. Bạn có thể nhập trực tiếp
                              thông tin đơn vị bên dưới hoặc thêm trước tại{' '}
                              <Link to='/my/settings' className='text-link'>
                                Cấu hình chung
                              </Link>
                              .
                            </p>
                          )}

                        {unitSaveNotice && (
                          <div className='space-y-2'>
                            <AlertError
                              title='Hồ sơ nháp đã được lưu nhưng chưa lưu được đơn vị'
                              errors={[unitSaveNotice]}
                            />
                            <p className='text-xs'>
                              <Link to='/my/settings' className='text-link'>
                                Mở Cấu hình chung để kiểm tra danh sách đơn vị →
                              </Link>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <form.Field name='localityId'>
                    {(field) => (
                      <div className='draft-lookup-box draft-unit-col draft-unit-col--locality'>
                        <div className='draft-lookup-header'>
                          <div className='draft-lookup-title'>
                            <MapPin className='size-4' aria-hidden='true' />
                            <span>Địa bàn hành chính &amp; năm đăng ký</span>
                          </div>
                        </div>

                        <div className='draft-lookup-grid draft-lookup-grid--locality'>
                          <form.Field name='provinceName'>
                            {(provinceField) => (
                              <FormField
                                label='Tỉnh/thành phố'
                                htmlFor='product-draft-1'
                                required
                                error={liveFieldErrors.provinceName}
                              >
                                <Combobox
                                  value={provinceField.state.value || ALL}
                                  disabled={busy}
                                  onValueChange={(value) => {
                                    const nextProvince = value === ALL ? '' : value;
                                    provinceField.handleChange(nextProvince);
                                    setSelectedProvince(nextProvince);
                                    const currentLoc =
                                      localityOptions.find(({ id }) => id === field.state.value) ??
                                      (product?.localityId === field.state.value
                                        ? product?.locality
                                        : null);
                                    if (
                                      !nextProvince ||
                                      currentLoc?.provinceName !== nextProvince
                                    ) {
                                      field.handleChange('');
                                      form.setFieldValue('localityName', '');
                                      form.setFieldValue('localityCode', '');
                                    }
                                  }}
                                >
                                  <ComboboxAnchor>
                                    <ComboboxInput
                                      id='product-draft-1'
                                      placeholder='Chọn tỉnh/thành phố trước'
                                      onBlur={provinceField.handleBlur}
                                    />
                                    <ComboboxTrigger />
                                  </ComboboxAnchor>
                                  <ComboboxContent>
                                    <ComboboxEmpty>Không tìm thấy tỉnh/thành phố.</ComboboxEmpty>
                                    <ComboboxItem value={ALL}>Chọn tỉnh/thành phố</ComboboxItem>
                                    {provinceField.state.value &&
                                      !ADMINISTRATIVE_PROVINCES.some(
                                        (item) => item.name_with_type === provinceField.state.value,
                                      ) && (
                                        <ComboboxItem value={provinceField.state.value}>
                                          {provinceField.state.value}
                                        </ComboboxItem>
                                      )}
                                    {ADMINISTRATIVE_PROVINCES.map((province) => (
                                      <ComboboxItem
                                        key={province.code}
                                        value={province.name_with_type}
                                      >
                                        {province.name_with_type}
                                      </ComboboxItem>
                                    ))}
                                  </ComboboxContent>
                                </Combobox>
                              </FormField>
                            )}
                          </form.Field>

                          <FormField
                            label='Chọn địa bàn'
                            htmlFor='editor-locality-select'
                            required
                            error={liveFieldErrors.localityId}
                          >
                            <Combobox
                              value={currentComboValue}
                              disabled={busy || !currentValues.provinceName}
                              onValueChange={(value) => {
                                if (value === ALL || !value) {
                                  field.handleChange('');
                                  form.setFieldValue('localityName', '');
                                  form.setFieldValue('localityCode', '');
                                  return;
                                }
                                if (value.startsWith('ward-name:')) {
                                  const wardName = value.slice('ward-name:'.length);
                                  const matchedWard = staticWardsInProvince.find(
                                    (w) => w.name_with_type === wardName || w.name === wardName,
                                  );
                                  field.handleChange('');
                                  form.setFieldValue('localityName', wardName);
                                  form.setFieldValue(
                                    'localityCode',
                                    matchedWard ? `XP${matchedWard.code}` : '',
                                  );
                                  return;
                                }
                                const existingLoc =
                                  localityOptions.find((l) => l.id === value) ??
                                  (product?.localityId === value ? product?.locality : null);
                                field.handleChange(value);
                                form.setFieldValue('localityName', existingLoc?.name ?? '');
                                form.setFieldValue('localityCode', existingLoc?.code ?? '');
                              }}
                            >
                              <ComboboxAnchor>
                                <ComboboxInput
                                  id='editor-locality-select'
                                  placeholder={
                                    currentValues.provinceName
                                      ? 'Chọn xã/phường trong tỉnh…'
                                      : 'Chọn tỉnh/thành phố trước'
                                  }
                                  onBlur={field.handleBlur}
                                />
                                <ComboboxTrigger />
                              </ComboboxAnchor>
                              <ComboboxContent>
                                <ComboboxEmpty>
                                  {currentValues.provinceName
                                    ? 'Không tìm thấy xã/phường phù hợp trong tỉnh đã chọn.'
                                    : 'Vui lòng chọn tỉnh/thành phố trước.'}
                                </ComboboxEmpty>
                                <ComboboxItem value={ALL}>Chưa chọn địa bàn</ComboboxItem>
                                {product?.localityId &&
                                  !localityOptions.some(({ id }) => id === product.localityId) && (
                                    <ComboboxItem value={product.localityId}>
                                      {product.locality
                                        ? `${product.locality.name} · ${product.locality.provinceName}`
                                        : product.localityId}
                                    </ComboboxItem>
                                  )}
                                {localityOptions.map((locality) => (
                                  <ComboboxItem key={locality.id} value={locality.id}>
                                    {`${locality.name} · ${locality.provinceName}`}
                                  </ComboboxItem>
                                ))}
                                {!currentValues.localityId &&
                                  currentValues.localityName &&
                                  !staticWardsInProvince.some(
                                    (ward) =>
                                      ward.name_with_type === currentValues.localityName &&
                                      !localityIdsByName.has(
                                        ward.name_with_type.trim().toLowerCase(),
                                      ) &&
                                      !localityIdsByName.has(ward.name.trim().toLowerCase()),
                                  ) && (
                                    <ComboboxItem value={`ward-name:${currentValues.localityName}`}>
                                      {currentValues.localityName} · {currentValues.provinceName}
                                    </ComboboxItem>
                                  )}
                                {staticWardsInProvince
                                  .filter(
                                    (ward) =>
                                      !localityIdsByName.has(
                                        ward.name_with_type.trim().toLowerCase(),
                                      ) && !localityIdsByName.has(ward.name.trim().toLowerCase()),
                                  )
                                  .map((ward) => (
                                    <ComboboxItem
                                      key={`ward-${ward.code}`}
                                      value={`ward-name:${ward.name_with_type}`}
                                    >
                                      {ward.name_with_type} · {currentValues.provinceName}
                                    </ComboboxItem>
                                  ))}
                              </ComboboxContent>
                            </Combobox>
                          </FormField>

                          <form.Field name='assessmentYear'>
                            {(yearField) => (
                              <FormField
                                label='Năm đăng ký'
                                htmlFor='product-draft-2'
                                required
                                error={liveFieldErrors.assessmentYear}
                              >
                                <Input
                                  id='product-draft-2'
                                  type='number'
                                  min={2020}
                                  max={2100}
                                  step={1}
                                  disabled={busy}
                                  value={yearField.state.value}
                                  onBlur={yearField.handleBlur}
                                  onChange={(event) => yearField.handleChange(event.target.value)}
                                />
                              </FormField>
                            )}
                          </form.Field>
                        </div>

                        {localityQuery.error && (
                          <AlertError
                            title='Không tải được danh mục địa bàn'
                            errors={[messageOf(localityQuery.error)]}
                          />
                        )}
                      </div>
                    )}
                  </form.Field>

                  <div className='draft-unit-col draft-unit-col--details'>
                    <div className='draft-lookup-header draft-unit-details-header'>
                      <div className='draft-lookup-title'>
                        <Building2 className='size-4' aria-hidden='true' />
                        <span>Đơn vị sản xuất &amp; thông tin liên hệ</span>
                      </div>
                    </div>

                    <div className='admin-step-grid draft-fields-grid draft-unit-fields-grid'>
                      {unitTextFields.map((config) => (
                        <form.Field key={config.name} name={config.name}>
                          {(field) => (
                            <FormField
                              label={config.label}
                              htmlFor={`product-draft-${config.name}`}
                              required={config.required}
                              error={
                                config.name !== 'email' ? liveFieldErrors[config.name] : undefined
                              }
                            >
                              <Input
                                id={`product-draft-${config.name}`}
                                type={config.type}
                                autoComplete={config.autoComplete}
                                value={field.state.value}
                                readOnly={config.disabled}
                                disabled={busy || config.disabled}
                                onBlur={field.handleBlur}
                                onChange={(event) => field.handleChange(event.target.value)}
                                placeholder={config.placeholder}
                                maxLength={config.maxLength}
                              />
                            </FormField>
                          )}
                        </form.Field>
                      ))}

                      <form.Field name='contactAddress'>
                        {(field) => (
                          <FormField
                            label='Địa chỉ liên hệ'
                            htmlFor='product-draft-3'
                            required
                            error={liveFieldErrors.contactAddress}
                            className='draft-address-field'
                          >
                            <Input
                              id='product-draft-3'
                              value={field.state.value}
                              disabled={busy}
                              onBlur={field.handleBlur}
                              onChange={(event) => field.handleChange(event.target.value)}
                              placeholder='Số nhà, đường, xã/phường, tỉnh/thành phố…'
                              maxLength={1000}
                            />
                          </FormField>
                        )}
                      </form.Field>
                    </div>
                  </div>
                </div>
              </section>

              {/* PHẦN 2: THÔNG TIN SẢN PHẨM */}
              <section className='draft-form-section' aria-labelledby='draft-section-product'>
                <div className='draft-step-header'>
                  <div>
                    <h2 id='draft-section-product'>Thông tin sản phẩm</h2>
                    <p className='draft-step-subtitle'>
                      Đặt tên sản phẩm, chọn nhóm ngành hàng OCOP và mô tả đặc trưng sản phẩm.
                    </p>
                  </div>
                  <span className='draft-step-counter'>Phần 2 / 3</span>
                </div>

                <div className='admin-step-grid draft-fields-grid draft-product-fields-grid'>
                  <form.Field name='name'>
                    {(field) => (
                      <FormField
                        label='Tên sản phẩm'
                        htmlFor='product-draft-4'
                        required
                        error={liveFieldErrors.name}
                      >
                        <Input
                          id='product-draft-4'
                          value={field.state.value}
                          disabled={busy}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder='Nhập tên thương mại chính thức của sản phẩm…'
                          maxLength={255}
                        />
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field name='categoryId'>
                    {(field) => (
                      <FormField
                        label='Danh mục sản phẩm'
                        htmlFor='product-draft-5'
                        required
                        error={liveFieldErrors.categoryId}
                      >
                        <Combobox
                          value={field.state.value || ALL}
                          disabled={busy}
                          onValueChange={(value) => field.handleChange(value === ALL ? '' : value)}
                        >
                          <ComboboxAnchor>
                            <ComboboxInput
                              id='product-draft-5'
                              placeholder='Chọn danh mục sản phẩm'
                              onBlur={field.handleBlur}
                            />
                            <ComboboxTrigger />
                          </ComboboxAnchor>
                          <ComboboxContent>
                            <ComboboxEmpty>Không tìm thấy danh mục.</ComboboxEmpty>
                            <ComboboxItem value={ALL}>Chọn danh mục sản phẩm</ComboboxItem>
                            {categories.map((item) => (
                              <ComboboxItem
                                key={item.id}
                                value={item.id}
                                disabled={item.unavailable}
                              >
                                {item.name}
                                {item.unavailable ? ' · Đã ngừng sử dụng' : ''}
                              </ComboboxItem>
                            ))}
                          </ComboboxContent>
                        </Combobox>
                        {categories.some(
                          (item) => item.id === field.state.value && item.unavailable,
                        ) && (
                          <p role='status' className='form-note'>
                            Danh mục của bản nháp đã ngừng sử dụng. Hồ sơ vẫn được lưu và chỉnh sửa;
                            hãy chọn danh mục đang hoạt động trước khi nộp.
                          </p>
                        )}
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field name='registrationType'>
                    {(field) => (
                      <FormField
                        label='Lần đăng ký đánh giá'
                        htmlFor='product-draft-7'
                        required
                        error={liveFieldErrors.registrationType}
                      >
                        <Combobox
                          value={field.state.value || ALL}
                          disabled={busy}
                          onValueChange={(value) =>
                            field.handleChange(
                              (value === ALL
                                ? ''
                                : value) as RegistrationFormData['registrationType'],
                            )
                          }
                        >
                          <ComboboxAnchor>
                            <ComboboxInput
                              id='product-draft-7'
                              placeholder='Chọn lần đăng ký'
                              onBlur={field.handleBlur}
                            />
                            <ComboboxTrigger />
                          </ComboboxAnchor>
                          <ComboboxContent>
                            <ComboboxEmpty>Không tìm thấy.</ComboboxEmpty>
                            <ComboboxItem value={ALL}>Chọn lần đăng ký</ComboboxItem>
                            <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.FIRST}>
                              Lần đầu
                            </ComboboxItem>
                            <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.UPGRADE}>
                              Nâng hạng
                            </ComboboxItem>
                            <ComboboxItem value={PRODUCT_REGISTRATION_TYPE.REASSESSMENT}>
                              Đánh giá lại
                            </ComboboxItem>
                          </ComboboxContent>
                        </Combobox>
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field name='sampleQuantity'>
                    {(field) => (
                      <FormField
                        label='Số lượng mẫu sản phẩm gửi kèm'
                        htmlFor='product-draft-sample-qty'
                        required
                        error={liveFieldErrors.sampleQuantity}
                      >
                        <Input
                          id='product-draft-sample-qty'
                          type='number'
                          min={1}
                          max={100000}
                          step={1}
                          disabled={busy}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder='VD: 2'
                        />
                      </FormField>
                    )}
                  </form.Field>

                  <form.Field name='description'>
                    {(field) => (
                      <FormField
                        label='Mô tả sản phẩm (tùy chọn)'
                        htmlFor='product-draft-6'
                        className='admin-step-span-2'
                      >
                        <Textarea
                          id='product-draft-6'
                          rows={4}
                          maxLength={10000}
                          disabled={busy}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder='Giới thiệu nguồn gốc nguyên liệu, quy trình sản xuất, câu chuyện sản phẩm và các chứng nhận chất lượng đạt được…'
                        />
                      </FormField>
                    )}
                  </form.Field>
                </div>
              </section>

              {/* PHẦN 3: TÀI LIỆU MINH CHỨNG & CAM KẾT */}
              <section className='draft-form-section' aria-labelledby='draft-section-evidence'>
                <div className='draft-step-header'>
                  <div>
                    <h2 id='draft-section-evidence'>Cam kết và tệp minh chứng</h2>
                    <p className='draft-step-subtitle'>
                      Đính kèm hình ảnh sản phẩm, tài liệu minh chứng và xác nhận cam kết theo Mẫu
                      01.
                    </p>
                  </div>
                  <span className='draft-step-counter'>Phần 3 / 3</span>
                </div>

                <div className='draft-step-three-stack'>
                  <div className='draft-upload-grid'>
                    {/* KHUNG 1: TỐI ĐA 5 FILE ẢNH / PDF (<= 2 MB) */}
                    <div className='draft-upload-card'>
                      <div className='draft-upload-head'>
                        <div className='draft-lookup-title'>
                          <FileUp className='size-4' aria-hidden='true' />
                          <span>Hình ảnh &amp; tài liệu minh chứng</span>
                        </div>
                        <span className='attachment-stat-pill is-mono'>
                          {totalRegularFilesCount} / {MAX_PRODUCT_FILES} tệp
                        </span>
                      </div>
                      <p className='draft-upload-hint'>
                        Hỗ trợ ảnh (<code>JPG</code>, <code>PNG</code>, <code>WEBP</code>,{' '}
                        <code>GIF</code>) và tài liệu (<code>PDF</code>). Tối đa{' '}
                        <strong>{MAX_PRODUCT_FILES} tệp</strong>, mỗi tệp không quá{' '}
                        <strong>2 MB</strong>.
                      </p>

                      <FileUpload
                        value={files}
                        onValueChange={setFiles}
                        accept={PRODUCT_DOCUMENT_IMAGE_ACCEPT}
                        maxFiles={remainingFileSlots}
                        maxSize={MAX_PRODUCT_FILE_BYTES}
                        multiple
                        disabled={busy || reviewRequired || remainingFileSlots === 0}
                        onFileValidate={(file) => {
                          try {
                            if (isVideoFileName(file.name)) {
                              return 'Vui lòng tải video ở khung Video sản phẩm bên cạnh.';
                            }
                            validateProductFile(file);
                            return null;
                          } catch (err) {
                            return messageOf(err);
                          }
                        }}
                        onFileReject={(_file, message) => {
                          setError(message);
                        }}
                      >
                        <FileUploadDropzone className='draft-file-dropzone'>
                          <div className='draft-file-dropzone-icon'>
                            <Upload className='size-5' aria-hidden='true' />
                          </div>
                          <div className='grid gap-1'>
                            <p className='draft-file-dropzone-title'>
                              Kéo thả ảnh/PDF vào đây hoặc nhấn để chọn tệp
                            </p>
                            <p className='draft-file-dropzone-sub'>
                              PNG, JPG, WEBP, GIF, PDF (còn trống {remainingFileSlots}/
                              {MAX_PRODUCT_FILES} tệp · tối đa 2 MB/tệp)
                            </p>
                          </div>
                          <FileUploadTrigger asChild>
                            <Button type='button' variant='secondary' size='sm' className='mt-1'>
                              Chọn tệp ảnh / PDF
                            </Button>
                          </FileUploadTrigger>
                        </FileUploadDropzone>

                        <FileUploadList className='mt-2'>
                          {files.map((file, index) => {
                            const filePreviewId = `local-file-${index}-${file.name}-${file.size}`;
                            const previewIdx = previewItems.findIndex(
                              (item) => item.id === filePreviewId,
                            );
                            return (
                              <FileUploadItem
                                key={`${index}:${file.name}:${file.size}`}
                                value={file}
                                className='draft-file-item'
                              >
                                {previewIdx >= 0 ? (
                                  <button
                                    type='button'
                                    className='cursor-zoom-in rounded border-0 bg-transparent p-0'
                                    onClick={() => setPreviewImageIndex(previewIdx)}
                                    aria-label={`Xem trước ảnh ${file.name}`}
                                  >
                                    <FileUploadItemPreview />
                                  </button>
                                ) : (
                                  <FileUploadItemPreview />
                                )}
                                <FileUploadItemMetadata />
                                <FileUploadItemDelete asChild>
                                  <Button type='button' variant='secondary' size='sm'>
                                    <Trash2 className='size-3.5' aria-hidden='true' />
                                    <span>Xóa</span>
                                  </Button>
                                </FileUploadItemDelete>
                              </FileUploadItem>
                            );
                          })}
                        </FileUploadList>

                        {files.length > 1 && (
                          <div className='mt-1 flex justify-end'>
                            <FileUploadClear asChild>
                              <Button type='button' variant='secondary' size='sm'>
                                Xóa tất cả tệp mới chọn ({files.length})
                              </Button>
                            </FileUploadClear>
                          </div>
                        )}
                      </FileUpload>
                    </div>

                    {/* KHUNG 2: TỐI ĐA 1 VIDEO (<= 50 MB) */}
                    <div className='draft-upload-card'>
                      <div className='draft-upload-head'>
                        <div className='draft-lookup-title'>
                          <Film className='size-4' aria-hidden='true' />
                          <span>Video giới thiệu sản phẩm (tùy chọn)</span>
                        </div>
                        <span className='attachment-stat-pill is-mono'>
                          {totalVideoFilesCount} / {MAX_PRODUCT_VIDEOS} video
                        </span>
                      </div>
                      <p className='draft-upload-hint'>
                        Hỗ trợ định dạng video (<code>MP4</code>, <code>WEBM</code>,{' '}
                        <code>MOV</code>). Tối đa <strong>{MAX_PRODUCT_VIDEOS} video</strong>, dung
                        lượng không quá <strong>50 MB</strong>.
                      </p>

                      <FileUpload
                        value={videoFiles}
                        onValueChange={setVideoFiles}
                        accept={PRODUCT_VIDEO_ACCEPT}
                        maxFiles={remainingVideoSlots}
                        maxSize={MAX_PRODUCT_VIDEO_BYTES}
                        multiple={false}
                        disabled={busy || reviewRequired || remainingVideoSlots === 0}
                        onFileValidate={(file) => {
                          try {
                            if (!isVideoFileName(file.name)) {
                              return 'Khung này chỉ nhận tệp video (MP4, WebM, MOV).';
                            }
                            validateProductFile(file);
                            return null;
                          } catch (err) {
                            return messageOf(err);
                          }
                        }}
                        onFileReject={(_file, message) => {
                          setError(message);
                        }}
                      >
                        <FileUploadDropzone className='draft-file-dropzone'>
                          <div className='draft-file-dropzone-icon'>
                            <Film className='size-5' aria-hidden='true' />
                          </div>
                          <div className='grid gap-1'>
                            <p className='draft-file-dropzone-title'>
                              Kéo thả video vào đây hoặc nhấn để chọn video
                            </p>
                            <p className='draft-file-dropzone-sub'>
                              MP4, WEBM, MOV (còn trống {remainingVideoSlots}/{MAX_PRODUCT_VIDEOS}{' '}
                              video · tối đa 50 MB)
                            </p>
                          </div>
                          <FileUploadTrigger asChild>
                            <Button type='button' variant='secondary' size='sm' className='mt-1'>
                              Chọn tệp video
                            </Button>
                          </FileUploadTrigger>
                        </FileUploadDropzone>

                        <FileUploadList className='mt-2'>
                          {videoFiles.map((file, index) => (
                            <FileUploadItem
                              key={`${index}:${file.name}:${file.size}`}
                              value={file}
                              className='draft-file-item'
                            >
                              <FileUploadItemPreview />
                              <FileUploadItemMetadata />
                              <FileUploadItemDelete asChild>
                                <Button type='button' variant='secondary' size='sm'>
                                  <Trash2 className='size-3.5' aria-hidden='true' />
                                  <span>Xóa</span>
                                </Button>
                              </FileUploadItemDelete>
                            </FileUploadItem>
                          ))}
                        </FileUploadList>
                      </FileUpload>
                    </div>
                  </div>

                  <form.Field name='declarationAccepted'>
                    {(field) => (
                      <div
                        className={
                          field.state.value
                            ? 'draft-declaration-card is-checked'
                            : 'draft-declaration-card'
                        }
                      >
                        <Checkbox
                          id='product-draft-declaration'
                          className='mt-0.5'
                          checked={field.state.value}
                          disabled={busy}
                          onBlur={field.handleBlur}
                          onCheckedChange={(checked) => field.handleChange(checked === true)}
                        />
                        <div className='draft-declaration-copy'>
                          <Label htmlFor='product-draft-declaration' className='cursor-pointer'>
                            Tôi cam đoan thông tin kê khai là đúng sự thật, tuân thủ quy định đánh
                            giá, phân hạng OCOP và chịu trách nhiệm về hồ sơ.{' '}
                            <span className='label-required-mark' aria-hidden='true'>
                              *
                            </span>
                          </Label>
                          {liveFieldErrors.declarationAccepted && (
                            <p
                              role='alert'
                              className='field-error text-destructive mt-1 text-xs leading-relaxed font-medium'
                            >
                              {liveFieldErrors.declarationAccepted}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </form.Field>
                </div>
              </section>
            </div>

            {(validationErrors.length > 0 || error) && (
              <AlertError
                title={
                  validationErrors.length > 0
                    ? activeSubmitIntent === 'submit'
                      ? 'Chưa đủ thông tin để nộp hồ sơ'
                      : 'Chưa đủ thông tin để lưu bản nháp'
                    : 'Không thể lưu bản nháp'
                }
                className='mt-4'
                errors={validationErrors.length > 0 ? validationErrors : [error]}
              />
            )}
          </form>

          {product && (
            <DraftSavedAttachmentsSection
              mode={mode}
              productId={product.id}
              attachments={product.attachments}
              previewItems={previewItems}
              onPreviewImage={setPreviewImageIndex}
            />
          )}
        </div>

        <DraftSummaryAside
          currentValues={currentValues}
          product={product}
          selectedCategoryObj={selectedCategoryObj}
          hasCompleteLocality={hasCompleteLocality}
          selectedLocalityDisplay={selectedLocalityDisplay}
          unsavedPrefilledFields={unsavedPrefilledFields}
          totalRegularFilesCount={totalRegularFilesCount}
          totalVideoFilesCount={totalVideoFilesCount}
          busy={busy}
          activeSubmitIntent={activeSubmitIntent}
          reviewRequired={reviewRequired}
          createOutcomeUnknown={createOutcomeUnknown}
          onSelectSubmitIntent={(intent) => {
            submitIntentRef.current = intent;
            setActiveSubmitIntent(intent);
          }}
        />
      </div>
      {uploadFailureId && (
        <p className='form-note'>
          {reviewRequired
            ? 'Hãy kiểm tra tệp đã nhận trước khi chọn lại.'
            : 'Có thể thử lại các tệp còn lại hoặc kiểm tra hồ sơ.'}{' '}
          {mode === PRODUCT_WORKSPACE_MODE.OWNER ? (
            <Link className='text-link' to='/my/products/$id' params={{ id: uploadFailureId }}>
              Mở hồ sơ và danh sách tệp
            </Link>
          ) : (
            <Link
              className='text-link'
              to='/admin/registrations/$id'
              params={{ id: uploadFailureId }}
              search={returnSearch}
            >
              Mở hồ sơ và danh sách tệp
            </Link>
          )}
        </p>
      )}
      {createOutcomeUnknown && (
        <p className='form-note'>
          {mode === PRODUCT_WORKSPACE_MODE.OWNER ? (
            <Link className='text-link' to='/my/products'>
              Mở danh sách nháp trước khi tạo lại
            </Link>
          ) : (
            <Link className='text-link' to='/admin/registrations' search={listReturnSearch}>
              Mở danh sách hồ sơ trước khi tạo lại
            </Link>
          )}
        </p>
      )}
      <ImagePreviewDialog
        items={previewItems}
        activeIndex={previewImageIndex}
        onIndexChange={setPreviewImageIndex}
        contextLabel={currentValues.name.trim() || product?.name || 'Hồ sơ sản phẩm'}
      />
    </PageContainer>
  );
}
