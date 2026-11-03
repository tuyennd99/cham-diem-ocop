import { useEffect, useRef, useState } from 'react';
import type { AdminUserRecord, LocalityRecord } from '@ocop/shared';
import { useForm, useStore } from '@tanstack/react-form';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import { omit, toString } from 'lodash';
import { toast } from 'sonner';
import {
  Building2,
  CheckCircle2,
  CircleDashed,
  FileUp,
  Film,
  MapPin,
  Trash2,
  Upload,
} from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
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
import { ALL } from '../../constants/consts';
import { FilterPanel, PageContainer, PageHeader, PageSection } from '../../layouts';
import {
  ADMINISTRATIVE_PROVINCES,
  useWardsByProvince,
} from '../../lib/administrative-divisions';
import { toAdminProductApiQuery, type AdminProductSearch } from '../../lib/admin-search';
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
import { canStartProductDraftSave, saveProductDraft } from '../../lib/save-product-draft';
import { hasStaffPermission } from '../../lib/session-contract';
import { AttachmentLink } from '../../pages/registrant/AttachmentLink';
import { useAdminProductDetail, useProductDraftCommands } from '../../queries/admin-products';
import { useRegistrantOwners } from '../../queries/admin-users';
import { useCategories, useLocalities } from '../../queries/common';
import { useMyProduct } from '../../queries/registrant';
import type {
  RegistrantProduct as Product,
  RegistrantFormData as RegistrationFormData,
} from '../../types/registrant';

interface ProductEditorFormValues extends RegistrationFormData {
  name: string;
  description: string;
  categoryId: string;
  localityId: string;
}

export interface ProductDraftEditorProps {
  mode: 'owner' | 'admin';
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
  entityName: '',
  representativeName: '',
  representativeTitle: '',
  contactAddress: '',
  provinceName: '',
  phone: '',
  email: '',
  registrationType: '',
  sampleQuantity: '',
  assessmentYear: currentYear,
  declarationAccepted: false,
};

const validRegistrationTypes = new Set<RegistrationFormData['registrationType']>([
  'FIRST',
  'UPGRADE',
  'REASSESSMENT',
]);

function toEditorValues(
  product: Product,
  accountDefaults?: { phone?: string | null; email?: string | null },
): ProductEditorFormValues {
  const saved = product.formData ?? {};
  const rawType = toString(saved.registrationType) as RegistrationFormData['registrationType'];
  const savedPhone = toString(saved.phone);
  const savedEmail = toString(saved.email);
  const savedProvince = toString(saved.provinceName) || (product.locality?.provinceName ?? '');
  return {
    name: product.name,
    description: product.description ?? '',
    categoryId: product.category.id,
    localityId: product.localityId ?? '',
    entityName: toString(saved.entityName),
    representativeName: toString(saved.representativeName),
    representativeTitle: toString(saved.representativeTitle),
    contactAddress: toString(saved.contactAddress),
    provinceName: savedProvince,
    phone: savedPhone || (accountDefaults?.phone ?? ''),
    email: savedEmail || (accountDefaults?.email ?? ''),
    registrationType: validRegistrationTypes.has(rawType) ? rawType : '',
    sampleQuantity: toString(saved.sampleQuantity),
    assessmentYear: saved.assessmentYear == null ? currentYear : toString(saved.assessmentYear),
    declarationAccepted: saved.declarationAccepted === true,
  };
}

function areEditorValuesEqual(a: ProductEditorFormValues, b: ProductEditorFormValues): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.categoryId === b.categoryId &&
    a.localityId === b.localityId &&
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
  name: 'entityName' | 'phone' | 'email';
  label: string;
  maxLength: number;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
}> = [
  {
    name: 'entityName',
    label: 'Tên đơn vị sản xuất',
    maxLength: 255,
    placeholder: 'Nhập tên đầy đủ',
  },
  {
    name: 'phone',
    label: 'Số điện thoại liên hệ',
    maxLength: 30,
    type: 'tel',
    autoComplete: 'tel',
    placeholder: 'VD: 0901 234 567',
  },
  {
    name: 'email',
    label: 'Email liên hệ',
    maxLength: 320,
    type: 'email',
    autoComplete: 'email',
    placeholder: 'VD: lienhe@donvi.vn',
    disabled: true,
  },
];

export function ProductDraftEditor({ mode, productId, returnSearch }: ProductDraftEditorProps) {
  const navigate = useNavigate();
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const listReturnSearch = returnSearch ? toAdminProductApiQuery(returnSearch) : undefined;
  const categoryQuery = useCategories();
  const ownerProductQuery = useMyProduct(mode === 'owner' ? productId : undefined);
  const adminProductQuery = useAdminProductDetail(
    'registrations',
    canManage,
    mode === 'admin' ? (productId ?? '') : '',
  );
  const queryProduct =
    mode === 'owner'
      ? ownerProductQuery.data
      : (adminProductQuery.data?.data as Product | undefined);
  const productError = mode === 'owner' ? ownerProductQuery.error : adminProductQuery.error;
  const productPending =
    Boolean(productId) &&
    (mode === 'owner' ? ownerProductQuery.isPending : adminProductQuery.isPending);
  const [localityPage, setLocalityPage] = useState(1);
  const [selectedProvince, setSelectedProvince] = useState('');
  const localityQuery = useLocalities(
    {
      page: localityPage,
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
  const defaultPhone = mode === 'owner' ? (session?.user.phone ?? '') : '';
  const defaultEmail =
    mode === 'owner'
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
  const initializedKeyRef = useRef<string | null>(null);
  const baselineRef = useRef<EditorBaselineSnapshot>({
    values: baselineValues,
    registrantId: '',
    reason: '',
  });
  const [error, setError] = useState('');
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
    mode === 'admin' && canManage && !productId,
  );
  const commands = useProductDraftCommands(mode, { registrantId, reason });
  const localityResolve = useLocalities(
    { page: 1, limit: 20, q: product?.locality?.code || undefined },
    Boolean(product?.localityId),
  );

  const form = useForm({
    defaultValues: baselineValues,
    onSubmit: async ({ value }) => {
      if (
        !canStartProductDraftSave({
          reviewRequired,
          createOutcomeUnknown,
          declarationAccepted: value.declarationAccepted,
        })
      )
        return;
      setError('');
      createStarted.current = false;
      setCreateOutcomeUnknown(false);
      setUploadFailureId('');
      try {
        const selectedFiles = [...files, ...videoFiles];
        if (mode === 'admin' && !product && !registrantId) {
          throw new Error('Chọn người đăng ký trước khi lưu hồ sơ.');
        }
        if (mode === 'admin' && !reason.trim()) {
          throw new Error('Nhập lý do thao tác trước khi lưu hồ sơ.');
        }
        if (!value.name.trim()) {
          throw new Error('Nhập tên sản phẩm trước khi lưu hồ sơ.');
        }
        if (!value.categoryId) {
          throw new Error('Chọn danh mục sản phẩm trước khi lưu hồ sơ.');
        }
        if (!value.declarationAccepted) {
          throw new Error('Vui lòng xác nhận cam kết trước khi lưu bản nháp.');
        }
        const sampleQuantity = value.sampleQuantity === '' ? 0 : Number(value.sampleQuantity);
        if (!Number.isInteger(sampleQuantity) || sampleQuantity < 0 || sampleQuantity > 100000) {
          throw new Error('Số lượng mẫu phải là số nguyên từ 0 đến 100000.');
        }
        const assessmentYear =
          value.assessmentYear === '' ? undefined : Number(value.assessmentYear);
        if (
          assessmentYear !== undefined &&
          (!Number.isInteger(assessmentYear) || assessmentYear < 2020 || assessmentYear > 2100)
        ) {
          throw new Error('Năm đánh giá phải là số nguyên từ 2020 đến 2100.');
        }
        const registrationFields = omit(value, ['name', 'description', 'categoryId', 'localityId']);
        const formData = {
          ...registrationFields,
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
        };
        const result = await saveProductDraft({
          existingProduct: product ?? undefined,
          payload,
          files: selectedFiles,
          commands: saveCommands,
        });
        setProduct(result.product);
        if (result.kind === 'upload-failed') {
          setReviewRequired(result.requiresReview);
          setUploadFailureId(result.product.id);
          setFiles(result.remainingFiles.filter((file) => !isVideoFileName(file.name)));
          setVideoFiles(result.remainingFiles.filter((file) => isVideoFileName(file.name)));
          setError(result.message);
          toast.error(result.message);
          return;
        }

        toast.success(product ? 'Đã cập nhật hồ sơ sản phẩm.' : 'Đã tạo hồ sơ sản phẩm mới.');
        setReviewRequired(false);
        setFiles([]);
        setVideoFiles([]);
        setBaselineValues(value);
        baselineRef.current = {
          values: value,
          registrantId,
          reason,
        };
        savedNavigation.current = true;
        try {
          if (mode === 'owner') {
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
        const unknownCreate =
          createStarted.current && !product && !(cause instanceof ApiError && cause.status < 500);
        setCreateOutcomeUnknown(unknownCreate);
        const errMsg = unknownCreate
          ? `${messageOf(cause)} Chưa rõ hồ sơ đã được tạo chưa; kiểm tra danh sách trước khi tạo lại.`
          : messageOf(cause);
        setError(errMsg);
        toast.error(errMsg);
      }
    },
  });

  const currentValues = useStore(form.store, (state) => state.values);
  const staticWardsInProvince = useWardsByProvince(currentValues.provinceName);
  const dirty =
    loaded &&
    (!areEditorValuesEqual(currentValues, baselineValues) ||
      files.length > 0 ||
      videoFiles.length > 0 ||
      (mode === 'admin' &&
        (registrantId !== baselineRef.current.registrantId ||
          reason !== baselineRef.current.reason)));

  useBlocker({
    shouldBlockFn: () =>
      !savedNavigation.current &&
      dirty &&
      !window.confirm('Hồ sơ có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
    enableBeforeUnload: () => dirty && !savedNavigation.current,
  });

  useEffect(() => {
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
    setProduct(current);
    setCategories(productEditorCategories(activeCategories, current));

    const sourceKey = `${productId ?? 'new'}:${current?.id ?? ''}:${current?.updatedAt ?? ''}:${activeCategories[0]?.id ?? ''}:${defaultPhone}:${defaultEmail}`;
    if (initializedKeyRef.current === sourceKey) {
      return;
    }
    initializedKeyRef.current = sourceKey;

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
    productError,
    productId,
    productPending,
    queryProduct,
  ]);

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
        <h1>Không tìm thấy bản nháp</h1>
        <AlertError
          title='Không tìm thấy bản nháp'
          errors={[error || 'Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.']}
        />
        {mode === 'owner' ? (
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
  if (product && product.status !== 'DRAFT') {
    return (
      <PageContainer className='admin-draft-editor'>
        <h1>Hồ sơ đã nộp</h1>
        <p>Hồ sơ không còn ở trạng thái bản nháp nên không thể sửa.</p>
        {mode === 'owner' ? (
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
  const localityTotalPages = localityQuery.data?.meta?.totalPages ?? 0;
  const registrantTotalPages = registrantLookup.data?.meta?.totalPages ?? 0;
  const localityIdsByName = new Map(
    localityOptions.map((loc) => [loc.name.trim().toLowerCase(), loc]),
  );
  const currentLocalityUnavailable = Boolean(
    product?.localityId &&
    localityResolve.data &&
    !localityResolve.data.data.some(({ id }) => id === product.localityId),
  );
  const activeRegistrantSummary =
    mode === 'owner'
      ? `${session?.user.fullName ?? 'Người đăng ký'}${session?.user.email ? ` (${session.user.email})` : ''}`
      : product
        ? `${adminProductQuery.data?.data.registrant.fullName ?? ''} (${adminProductQuery.data?.data.registrant.email ?? ''})`
        : selectedRegistrant
          ? `${selectedRegistrant.fullName} (${selectedRegistrant.email})`
          : 'Chưa chọn người đăng ký';

  const backLink =
    mode === 'admin' ? (
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
  const selectedCategoryObj = categories.find(({ id }) => id === currentValues.categoryId);
  const savedAttachments = product?.attachments ?? [];
  const savedVideoCount = savedAttachments.filter((att) => isVideoFileName(att.fileName)).length;
  const savedFileCount = savedAttachments.length - savedVideoCount;
  const remainingFileSlots = Math.max(0, MAX_PRODUCT_FILES - savedFileCount);
  const remainingVideoSlots = Math.max(0, MAX_PRODUCT_VIDEOS - savedVideoCount);
  const totalRegularFilesCount = savedFileCount + files.length;
  const totalVideoFilesCount = savedVideoCount + videoFiles.length;

  return (
    <PageContainer className='admin-draft-editor'>
      <PageHeader
        backLink={backLink}
        title={
          mode === 'admin'
            ? productId
              ? 'Sửa phiếu đăng ký'
              : 'Nhập phiếu đăng ký'
            : productId
              ? 'Sửa hồ sơ nháp'
              : 'Tạo hồ sơ sản phẩm'
        }
        badge={<Badge variant='secondary'>Bản nháp</Badge>}
        description={
          <>
            Người đăng ký: <strong>{activeRegistrantSummary}</strong> · Đính kèm tối đa{' '}
            {MAX_PRODUCT_FILES} tệp ảnh/PDF (mỗi tệp không quá 2 MB) và {MAX_PRODUCT_VIDEOS} video
            (không quá 50 MB).
          </>
        }
      />

      {mode === 'admin' && (
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
                      disabled={registrantPage <= 1 || registrantLookup.isPending}
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
            className='admin-form filter-card draft-form-card'
            onSubmit={(event) => {
              event.preventDefault();
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

                <div className='admin-step-grid draft-fields-grid draft-unit-fields-grid'>
                  <form.Field name='localityId'>
                    {(field) => (
                      <div className='draft-lookup-box admin-step-span-2'>
                        <div className='draft-lookup-header'>
                          <div className='draft-lookup-title'>
                            <MapPin className='size-4' aria-hidden='true' />
                            <span>Địa bàn hành chính &amp; năm đăng ký</span>
                          </div>
                          <div className='draft-lookup-pager'>
                            <Button
                              variant='secondary'
                              size='sm'
                              type='button'
                              disabled={localityPage <= 1 || localityQuery.isPending}
                              onClick={() => setLocalityPage((page) => Math.max(1, page - 1))}
                            >
                              Trước
                            </Button>
                            <span className='draft-lookup-page-label'>
                              {localityTotalPages > 0
                                ? `Trang ${localityPage}/${localityTotalPages}`
                                : 'Chưa có địa bàn'}
                            </span>
                            <Button
                              variant='secondary'
                              size='sm'
                              type='button'
                              disabled={
                                localityQuery.isPending ||
                                localityTotalPages === 0 ||
                                localityPage >= localityTotalPages
                              }
                              onClick={() => setLocalityPage((page) => page + 1)}
                            >
                              Sau
                            </Button>
                          </div>
                        </div>

                        <div className='draft-lookup-grid draft-lookup-grid--locality'>
                          <form.Field name='provinceName'>
                            {(provinceField) => (
                              <FormField label='Tỉnh/thành phố' htmlFor='product-draft-1'>
                                <Combobox
                                  value={provinceField.state.value || ALL}
                                  onValueChange={(value) => {
                                    const nextProvince = value === ALL ? '' : value;
                                    provinceField.handleChange(nextProvince);
                                    setSelectedProvince(nextProvince);
                                    setLocalityPage(1);
                                    const currentLoc =
                                      localityOptions.find(({ id }) => id === field.state.value) ??
                                      (product?.localityId === field.state.value
                                        ? product?.locality
                                        : null);
                                    if (!nextProvince || currentLoc?.provinceName !== nextProvince) {
                                      field.handleChange('');
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
                                        (item) =>
                                          item.name_with_type === provinceField.state.value,
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
                            label='Chọn địa bàn hành chính (xã/phường)'
                            htmlFor='editor-locality-select'
                          >
                            <Combobox
                              value={field.state.value || ALL}
                              disabled={!currentValues.provinceName}
                              onValueChange={(value) =>
                                field.handleChange(value === ALL ? '' : value)
                              }
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
                                    <ComboboxItem
                                      value={product.localityId}
                                      disabled={currentLocalityUnavailable}
                                    >
                                      {product.locality
                                        ? `${product.locality.name} · ${product.locality.provinceName}`
                                        : product.localityId}
                                      {currentLocalityUnavailable ? ' · Đã ngừng hiệu lực' : ''}
                                    </ComboboxItem>
                                  )}
                                {localityOptions.map((locality) => (
                                  <ComboboxItem key={locality.id} value={locality.id}>
                                    {locality.name} · {locality.provinceName}
                                  </ComboboxItem>
                                ))}
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
                                      value={`ward-${ward.code}`}
                                      disabled
                                    >
                                      {ward.name_with_type} (chưa mở đăng ký trên hệ thống)
                                    </ComboboxItem>
                                  ))}
                              </ComboboxContent>
                            </Combobox>
                          </FormField>

                          <form.Field name='assessmentYear'>
                            {(yearField) => (
                              <FormField label='Năm đăng ký' htmlFor='product-draft-2'>
                                <Input
                                  id='product-draft-2'
                                  type='number'
                                  min={2020}
                                  max={2100}
                                  step={1}
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
                        {currentLocalityUnavailable && (
                          <p role='status' className='draft-lookup-hint is-warning'>
                            Địa bàn đã ngừng hoạt động hoặc hết hiệu lực. Bản nháp vẫn giữ lựa chọn;
                            hãy chọn địa bàn đang hiệu lực trước khi nộp.
                          </p>
                        )}
                        {!field.state.value && (
                          <p className='draft-lookup-hint'>
                            Có thể lưu nháp khi chưa chọn địa bàn; cần chọn địa bàn hiệu lực trước
                            khi nộp hồ sơ.
                          </p>
                        )}
                      </div>
                    )}
                  </form.Field>

                  {unitTextFields.map((config) => (
                    <form.Field key={config.name} name={config.name}>
                      {(field) => (
                        <FormField label={config.label} htmlFor={`product-draft-${config.name}`}>
                          <Input
                            id={`product-draft-${config.name}`}
                            type={config.type}
                            autoComplete={config.autoComplete}
                            value={field.state.value}
                            readOnly={config.disabled}
                            disabled={config.disabled}
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
                        className='draft-address-field'
                      >
                        <Input
                          id='product-draft-3'
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(event) => field.handleChange(event.target.value)}
                          placeholder='Số nhà, đường, xã/phường, tỉnh/thành phố…'
                          maxLength={1000}
                        />
                      </FormField>
                    )}
                  </form.Field>
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
                      <FormField label='Tên sản phẩm' htmlFor='product-draft-4' required>
                        <Input
                          id='product-draft-4'
                          value={field.state.value}
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
                      <FormField label='Danh mục sản phẩm' htmlFor='product-draft-5' required>
                        <Combobox
                          value={field.state.value || ALL}
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
                      <FormField label='Lần đăng ký đánh giá' htmlFor='product-draft-7'>
                        <Combobox
                          value={field.state.value || ALL}
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
                            <ComboboxItem value='FIRST'>Lần đầu</ComboboxItem>
                            <ComboboxItem value='UPGRADE'>Nâng hạng</ComboboxItem>
                            <ComboboxItem value='REASSESSMENT'>Đánh giá lại</ComboboxItem>
                          </ComboboxContent>
                        </Combobox>
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

                      <form.Subscribe selector={(state) => state.isSubmitting}>
                        {(busy) => (
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
                                <Button
                                  type='button'
                                  variant='secondary'
                                  size='sm'
                                  className='mt-1'
                                >
                                  Chọn tệp ảnh / PDF
                                </Button>
                              </FileUploadTrigger>
                            </FileUploadDropzone>

                            <FileUploadList className='mt-2'>
                              {files.map((file, index) => (
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
                        )}
                      </form.Subscribe>
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

                      <form.Subscribe selector={(state) => state.isSubmitting}>
                        {(busy) => (
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
                                  MP4, WEBM, MOV (còn trống {remainingVideoSlots}/
                                  {MAX_PRODUCT_VIDEOS} video · tối đa 50 MB)
                                </p>
                              </div>
                              <FileUploadTrigger asChild>
                                <Button
                                  type='button'
                                  variant='secondary'
                                  size='sm'
                                  className='mt-1'
                                >
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
                        )}
                      </form.Subscribe>
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
                          <p>
                            Cần tích chọn cam kết này trước khi lưu bản nháp và nộp hồ sơ chính
                            thức.
                          </p>
                        </div>
                      </div>
                    )}
                  </form.Field>
                </div>
              </section>
            </div>

            {error && <AlertError title='Không thể lưu bản nháp' errors={[error]} />}
          </form>

          {product && (
            <PageSection aria-label='Tệp đã lưu' className='p-5'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-sm font-semibold'>Hồ sơ đã lưu: {product.id}</p>
                <Badge variant='secondary'>{product.attachments.length} tệp đính kèm</Badge>
              </div>
              <ul className='draft-saved-attachments mt-3'>
                {product.attachments.map((file) => (
                  <li key={file.id} className='draft-saved-attachment-item'>
                    <span className='attachment-ext-tag'>
                      {isVideoFileName(file.fileName)
                        ? 'VIDEO'
                        : file.type === 'IMAGE'
                          ? 'ẢNH'
                          : 'TÀI LIỆU'}
                    </span>
                    <AttachmentLink
                      mode={mode}
                      productId={product.id}
                      attachmentId={file.id}
                      name={file.fileName}
                    />
                  </li>
                ))}
              </ul>
            </PageSection>
          )}
        </div>

        <aside className='draft-summary-aside' aria-label='Tóm tắt hồ sơ đang nhập'>
          <div className='draft-summary-card'>
            <div className='draft-summary-head'>
              <h3>Tóm tắt phiếu đăng ký</h3>
            </div>
            <p className='draft-summary-note'>
              Bạn có thể lưu bản nháp sau khi nhập <strong>Tên sản phẩm</strong>, chọn{' '}
              <strong>Danh mục sản phẩm</strong> và <strong>xác nhận cam kết</strong>.
            </p>

            <ul className='draft-checklist'>
              <li className={currentValues.name.trim() ? 'is-done' : undefined}>
                {currentValues.name.trim() ? (
                  <CheckCircle2 className='size-4' aria-hidden='true' />
                ) : (
                  <CircleDashed className='size-4' aria-hidden='true' />
                )}
                <div>
                  <strong>
                    Tên sản phẩm{' '}
                    <span className='label-required-mark' aria-hidden='true'>
                      *
                    </span>
                  </strong>
                  <span>{currentValues.name.trim() || 'Chưa nhập tên sản phẩm'}</span>
                </div>
              </li>
              <li className={currentValues.categoryId ? 'is-done' : undefined}>
                {currentValues.categoryId ? (
                  <CheckCircle2 className='size-4' aria-hidden='true' />
                ) : (
                  <CircleDashed className='size-4' aria-hidden='true' />
                )}
                <div>
                  <strong>
                    Danh mục sản phẩm{' '}
                    <span className='label-required-mark' aria-hidden='true'>
                      *
                    </span>
                  </strong>
                  <span>{selectedCategoryObj?.name ?? 'Chưa chọn danh mục'}</span>
                </div>
              </li>
              <li className={currentValues.localityId ? 'is-done' : undefined}>
                {currentValues.localityId ? (
                  <CheckCircle2 className='size-4' aria-hidden='true' />
                ) : (
                  <CircleDashed className='size-4' aria-hidden='true' />
                )}
                <div>
                  <strong>Địa bàn hành chính</strong>
                  <span>
                    {selectedLocalityObj
                      ? `${selectedLocalityObj.name} · ${selectedLocalityObj.provinceName}`
                      : 'Chưa chọn xã/phường'}
                  </span>
                </div>
              </li>
              <li className={currentValues.declarationAccepted ? 'is-done' : undefined}>
                {currentValues.declarationAccepted ? (
                  <CheckCircle2 className='size-4' aria-hidden='true' />
                ) : (
                  <CircleDashed className='size-4' aria-hidden='true' />
                )}
                <div>
                  <strong>
                    Cam kết chủ thể OCOP{' '}
                    <span className='label-required-mark' aria-hidden='true'>
                      *
                    </span>
                  </strong>
                  <span>
                    {currentValues.declarationAccepted
                      ? 'Đã xác nhận cam kết'
                      : 'Cần xác nhận trước khi lưu'}
                  </span>
                </div>
              </li>
            </ul>

            <dl className='draft-summary-facts'>
              <div>
                <dt>Đơn vị sản xuất</dt>
                <dd>{currentValues.entityName?.trim() || 'Chưa khai báo'}</dd>
              </div>
              <div>
                <dt>Số điện thoại</dt>
                <dd>{currentValues.phone?.trim() || 'Chưa khai báo'}</dd>
              </div>
              <div>
                <dt>Email liên hệ</dt>
                <dd>{currentValues.email?.trim() || 'Chưa khai báo'}</dd>
              </div>
              <div>
                <dt>Năm đánh giá</dt>
                <dd>{currentValues.assessmentYear || currentYear}</dd>
              </div>
              <div>
                <dt>Tệp ảnh / PDF</dt>
                <dd>
                  {totalRegularFilesCount} / {MAX_PRODUCT_FILES} tệp (≤ 2 MB)
                </dd>
              </div>
              <div>
                <dt>Video sản phẩm</dt>
                <dd>
                  {totalVideoFilesCount} / {MAX_PRODUCT_VIDEOS} video (≤ 50 MB)
                </dd>
              </div>
            </dl>

            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(busy) => (
                <div className='draft-summary-actions'>
                  <Button
                    type='submit'
                    form='product-draft-form'
                    variant='primary'
                    className='w-full'
                    loading={busy}
                    disabled={
                      busy ||
                      !canStartProductDraftSave({
                        reviewRequired,
                        createOutcomeUnknown,
                        declarationAccepted: currentValues.declarationAccepted,
                      })
                    }
                  >
                    {busy ? 'Đang lưu…' : 'Lưu bản nháp'}
                  </Button>
                </div>
              )}
            </form.Subscribe>
          </div>
        </aside>
      </div>
      {uploadFailureId && (
        <p className='form-note'>
          {reviewRequired
            ? 'Hãy kiểm tra tệp đã nhận trước khi chọn lại.'
            : 'Có thể thử lại các tệp còn lại hoặc kiểm tra hồ sơ.'}{' '}
          {mode === 'owner' ? (
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
          {mode === 'owner' ? (
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
    </PageContainer>
  );
}
