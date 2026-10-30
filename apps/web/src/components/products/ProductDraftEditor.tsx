import { useEffect, useRef, useState } from 'react';
import type { AdminUserRecord, LocalityRecord } from '@ocop/shared';
import { useForm, useStore } from '@tanstack/react-form';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import { omit, toString } from 'lodash';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ALL } from '../../constants/consts';
import { toAdminProductApiQuery, type AdminProductSearch } from '../../lib/admin-search';
import { ApiError, messageOf } from '../../lib/api-error';
import { PRODUCT_FILE_ACCEPT } from '../../lib/attachments';
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

function toEditorValues(product: Product): ProductEditorFormValues {
  const saved = product.formData ?? {};
  const rawType = toString(saved.registrationType) as RegistrationFormData['registrationType'];
  return {
    name: product.name,
    description: product.description ?? '',
    categoryId: product.category.id,
    localityId: product.localityId ?? '',
    entityName: toString(saved.entityName),
    representativeName: toString(saved.representativeName),
    representativeTitle: toString(saved.representativeTitle),
    contactAddress: toString(saved.contactAddress),
    provinceName: toString(saved.provinceName),
    phone: toString(saved.phone),
    email: toString(saved.email),
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

const applicationSteps = ['Đơn vị đăng ký', 'Thông tin sản phẩm', 'Cam kết và tệp'];

const stepZeroTextFields: Array<{
  name:
    | 'provinceName'
    | 'entityName'
    | 'representativeName'
    | 'representativeTitle'
    | 'phone'
    | 'email';
  label: string;
  maxLength: number;
  type?: string;
  autoComplete?: string;
}> = [
  { name: 'provinceName', label: 'Tỉnh/thành phố đăng ký', maxLength: 100 },
  { name: 'entityName', label: 'Tên đơn vị sản xuất', maxLength: 255 },
  { name: 'representativeName', label: 'Người đại diện theo pháp luật', maxLength: 255 },
  { name: 'representativeTitle', label: 'Chức danh người đại diện', maxLength: 255 },
  { name: 'phone', label: 'Số điện thoại', maxLength: 30, type: 'tel', autoComplete: 'tel' },
  { name: 'email', label: 'Email liên hệ', maxLength: 320, type: 'email', autoComplete: 'email' },
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
  const [localitySearch, setLocalitySearch] = useState('');
  const [localityPage, setLocalityPage] = useState(1);
  const localityQuery = useLocalities({
    page: localityPage,
    limit: 20,
    q: localitySearch || undefined,
  });
  const [categories, setCategories] = useState<ProductEditorCategory[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const createStarted = useRef(false);
  const savedNavigation = useRef(false);
  const baselineRef = useRef<EditorBaselineSnapshot>({
    values: emptyEditorValues,
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
    defaultValues: emptyEditorValues,
    onSubmit: async ({ value }) => {
      if (!canStartProductDraftSave({ reviewRequired, createOutcomeUnknown })) return;
      setError('');
      createStarted.current = false;
      setCreateOutcomeUnknown(false);
      setUploadFailureId('');
      try {
        const selectedFiles = files;
        if (mode === 'admin' && !product && !registrantId) {
          throw new Error('Chọn người đăng ký trước khi lưu hồ sơ.');
        }
        if (mode === 'admin' && !reason.trim()) {
          throw new Error('Nhập lý do thao tác trước khi lưu hồ sơ.');
        }
        if (!value.name.trim()) {
          setStep(1);
          throw new Error('Nhập tên sản phẩm ở Bước 2 trước khi lưu hồ sơ.');
        }
        if (!value.categoryId) {
          setStep(1);
          throw new Error('Chọn danh mục sản phẩm ở Bước 2 trước khi lưu hồ sơ.');
        }
        const sampleQuantity = value.sampleQuantity === '' ? 0 : Number(value.sampleQuantity);
        if (!Number.isInteger(sampleQuantity) || sampleQuantity < 0 || sampleQuantity > 100000) {
          setStep(1);
          throw new Error('Số lượng mẫu phải là số nguyên từ 0 đến 100000.');
        }
        const assessmentYear =
          value.assessmentYear === '' ? undefined : Number(value.assessmentYear);
        if (
          assessmentYear !== undefined &&
          (!Number.isInteger(assessmentYear) || assessmentYear < 2020 || assessmentYear > 2100)
        ) {
          setStep(0);
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
          setFiles(result.remainingFiles);
          if (fileInput.current) {
            const selection = new DataTransfer();
            result.remainingFiles.forEach((file) => selection.items.add(file));
            fileInput.current.files = selection.files;
          }
          setError(result.message);
          return;
        }

        setReviewRequired(false);
        setFiles([]);
        if (fileInput.current) fileInput.current.value = '';
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
        setError(
          unknownCreate
            ? `${messageOf(cause)} Chưa rõ hồ sơ đã được tạo chưa; kiểm tra danh sách trước khi tạo lại.`
            : messageOf(cause),
        );
      }
    },
  });

  const currentValues = useStore(form.store, (state) => state.values);
  const dirty =
    loaded &&
    (!areEditorValuesEqual(currentValues, baselineRef.current.values) ||
      files.length > 0 ||
      (mode === 'admin' &&
        (registrantId !== baselineRef.current.registrantId ||
          reason !== baselineRef.current.reason)));

  useBlocker({
    shouldBlockFn: () =>
      mode === 'admin' &&
      !savedNavigation.current &&
      dirty &&
      !window.confirm('Hồ sơ có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
    enableBeforeUnload: () => mode === 'admin' && dirty && !savedNavigation.current,
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
    if (current) {
      const nextValues = toEditorValues(current);
      form.reset(nextValues);
      baselineRef.current = {
        values: nextValues,
        registrantId: '',
        reason: '',
      };
      setLocalitySearch(current.locality?.code ?? '');
    } else if (!productId) {
      const nextValues = {
        ...emptyEditorValues,
        categoryId: activeCategories[0]?.id ?? '',
      };
      form.reset(nextValues);
      baselineRef.current = {
        values: nextValues,
        registrantId: '',
        reason: '',
      };
      setLocalitySearch('');
    }
  }, [
    categoryQuery.data,
    categoryQuery.error,
    categoryQuery.isPending,
    form,
    productError,
    productId,
    productPending,
    queryProduct,
  ]);

  const editorClassName = mode === 'admin' ? 'admin-page admin-draft-editor' : 'route-panel';

  if (productId && !loaded && !error) {
    return (
      <section className={editorClassName} aria-busy='true'>
        <PageSpin />
      </section>
    );
  }
  if (productId && loaded && !product) {
    return (
      <section className={editorClassName}>
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
      </section>
    );
  }
  if (product && product.status !== 'DRAFT') {
    return (
      <section className={editorClassName}>
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
      </section>
    );
  }

  const localityOptions: LocalityRecord[] = localityQuery.data?.data ?? [];
  const localityTotalPages = localityQuery.data?.meta?.totalPages ?? 0;
  const registrantTotalPages = registrantLookup.data?.meta?.totalPages ?? 0;
  const currentLocalityUnavailable = Boolean(
    product?.localityId &&
    localityResolve.data &&
    !localityResolve.data.data.some(({ id }) => id === product.localityId),
  );
  const activeRegistrantSummary = product
    ? `${adminProductQuery.data?.data.registrant.fullName ?? ''} (${adminProductQuery.data?.data.registrant.email ?? ''})`
    : selectedRegistrant
      ? `${selectedRegistrant.fullName} (${selectedRegistrant.email})`
      : 'Chưa chọn người đăng ký';

  return (
    <section className={editorClassName}>
      {mode === 'admin' ? (
        <div className='admin-page-heading'>
          <div>
            <Link
              className='text-link text-sm'
              to={product ? '/admin/registrations/$id' : '/admin/registrations'}
              params={product ? { id: product.id } : undefined}
              search={product ? returnSearch : listReturnSearch}
            >
              ← {product ? 'Quay lại chi tiết phiếu' : 'Quay lại danh sách phiếu đăng ký'}
            </Link>
            <h1 className='mt-2'>{productId ? 'Sửa phiếu đăng ký' : 'Nhập phiếu đăng ký'}</h1>
            <p className='route-intro'>
              Người đăng ký: <strong>{activeRegistrantSummary}</strong> · Trạng thái: Bản nháp. Ảnh và tài
              liệu minh chứng tùy chọn (tối đa 20 tệp, mỗi tệp 10 MiB).
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className='eyebrow'>KHU VỰC NGƯỜI ĐĂNG KÝ · MẪU 01</p>
          <h1>{productId ? 'Sửa hồ sơ nháp' : 'Tạo hồ sơ sản phẩm'}</h1>
          <p>
            Hoàn thành phiếu đăng ký theo từng bước. Ảnh và tài liệu minh chứng là tùy chọn; mỗi tệp
            tối đa 10 MiB.
          </p>
        </>
      )}

      {mode === 'admin' && (
        <div className='admin-form filter-card'>
          <h2 className='mb-2'>Ngữ cảnh thao tác quản trị</h2>
          <div className='admin-step-grid'>
            {!product ? (
              <>
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
                <div className='form-group'>
                  <Label htmlFor='admin-draft-registrant-select'>
                    Chọn người đăng ký (bắt buộc)
                  </Label>
                  <Select
                    value={registrantId || ALL}
                    onValueChange={(value) => {
                      const nextId = value === ALL ? '' : value;
                      const selected =
                        registrantLookup.data?.data.find(({ id }) => id === nextId) ?? null;
                      setRegistrantId(nextId);
                      setSelectedRegistrant(selected);
                    }}
                  >
                    <SelectTrigger id='admin-draft-registrant-select'>
                      <SelectValue placeholder='Chọn người đăng ký' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Chọn người đăng ký</SelectItem>
                      {selectedRegistrant &&
                        !registrantLookup.data?.data.some(
                          ({ id }) => id === selectedRegistrant.id,
                        ) && (
                          <SelectItem value={selectedRegistrant.id}>
                            {selectedRegistrant.fullName} · {selectedRegistrant.email}
                          </SelectItem>
                        )}
                      {registrantLookup.data?.data.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.fullName} · {owner.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {registrantLookup.error && (
                    <AlertError
                      title='Không tải được danh sách người đăng ký'
                      errors={[messageOf(registrantLookup.error)]}
                    />
                  )}
                  <div className='admin-actions mt-2'>
                    <Button
                      variant='secondary'
                      size='sm'
                      type='button'
                      disabled={registrantPage <= 1 || registrantLookup.isPending}
                      onClick={() => setRegistrantPage((page) => Math.max(1, page - 1))}
                    >
                      Trước
                    </Button>
                    <span className='text-muted text-xs'>
                      {registrantTotalPages > 0
                        ? `Trang ${registrantPage} / ${registrantTotalPages}`
                        : 'Chưa có người đăng ký phù hợp'}
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
              </>
            ) : (
              <div>
                <span className='text-sm font-semibold'>Người đăng ký sở hữu hồ sơ</span>
                <p className='text-muted mt-1 text-sm'>
                  {adminProductQuery.data?.data.registrant.fullName} ·{' '}
                  {adminProductQuery.data?.data.registrant.email}
                </p>
              </div>
            )}

            <FormField label='Lý do thao tác (bắt buộc)' htmlFor='admin-draft-reason'>
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
        </div>
      )}

      <div>
        <p className='text-muted mb-2 text-sm font-semibold'>
          Bước {step + 1}/3 · {applicationSteps[step]}
        </p>
        <ol className='form-steps' aria-label='Các bước đăng ký'>
          {applicationSteps.map((label, index) => (
            <li key={label}>
              <button
                type='button'
                aria-current={index === step ? 'step' : undefined}
                onClick={() => setStep(index)}
              >
                <span>{index + 1}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <form
        className={mode === 'admin' ? 'admin-form filter-card' : 'account-form'}
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <h2 className='mb-4'>
          Bước {step + 1} · {applicationSteps[step]}
        </h2>
        {step === 0 && (
          <div className={mode === 'admin' ? 'admin-step-grid' : undefined}>
            <form.Field name='localityId'>
              {(field) => (
                <div className={mode === 'admin' ? 'admin-step-span-2' : undefined}>
                  <FormField
                    label='Địa bàn hành chính (xã/phường)'
                    htmlFor='editor-locality-search'
                  >
                    <Input
                      id='editor-locality-search'
                      value={localitySearch}
                      onChange={(event) => {
                        setLocalitySearch(event.target.value);
                        setLocalityPage(1);
                      }}
                      placeholder='Tìm xã/phường hoặc tỉnh/thành'
                      maxLength={100}
                    />
                  </FormField>
                  <FormField
                    label='Chọn địa bàn hành chính'
                    htmlFor='editor-locality-select'
                    className='mt-2'
                  >
                    <Select
                      value={field.state.value || ALL}
                      onValueChange={(value) => field.handleChange(value === ALL ? '' : value)}
                    >
                      <SelectTrigger id='editor-locality-select' onBlur={field.handleBlur}>
                        <SelectValue placeholder='Chưa chọn địa bàn' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Chưa chọn địa bàn</SelectItem>
                        {product?.localityId &&
                          !localityOptions.some(({ id }) => id === product.localityId) && (
                            <SelectItem
                              value={product.localityId}
                              disabled={currentLocalityUnavailable}
                            >
                              {product.locality
                                ? `${product.locality.name} · ${product.locality.provinceName}`
                                : product.localityId}
                              {currentLocalityUnavailable ? ' · Đã ngừng hiệu lực' : ''}
                            </SelectItem>
                          )}
                        {localityOptions.map((locality) => (
                          <SelectItem key={locality.id} value={locality.id}>
                            {locality.name} · {locality.provinceName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  {localityQuery.error && (
                    <AlertError
                      title='Không tải được danh mục địa bàn'
                      errors={[messageOf(localityQuery.error)]}
                    />
                  )}
                  {currentLocalityUnavailable && (
                    <p role='status' className='form-note'>
                      Địa bàn đã ngừng hoạt động hoặc hết hiệu lực. Bản nháp vẫn giữ lựa chọn; hãy
                      chọn địa bàn đang hiệu lực trước khi nộp.
                    </p>
                  )}
                  {!field.state.value && (
                    <p className='form-note'>
                      Có thể lưu nháp khi chưa chọn địa bàn; cần chọn địa bàn hiệu lực trước khi
                      nộp.
                    </p>
                  )}
                  <div className='hero-actions mt-2'>
                    <Button
                      variant='secondary'
                      type='button'
                      disabled={localityPage <= 1 || localityQuery.isPending}
                      onClick={() => setLocalityPage((page) => Math.max(1, page - 1))}
                    >
                      Trước
                    </Button>
                    <span>
                      {localityTotalPages > 0
                        ? `Trang ${localityPage} / ${localityTotalPages}`
                        : 'Chưa có địa bàn phù hợp'}
                    </span>
                    <Button
                      variant='secondary'
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
              )}
            </form.Field>
            <form.Field name='provinceName'>
              {(field) => (
                <FormField label='Tỉnh/thành phố đăng ký' htmlFor='product-draft-1'>
                  <Input
                    id='product-draft-1'
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={100}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name='assessmentYear'>
              {(field) => (
                <FormField label='Năm đăng ký' htmlFor='product-draft-2'>
                  <Input
                    id='product-draft-2'
                    type='number'
                    min={2020}
                    max={2100}
                    step={1}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </FormField>
              )}
            </form.Field>
            {stepZeroTextFields.slice(1, 4).map((config) => (
              <form.Field key={config.name} name={config.name}>
                {(field) => (
                  <FormField label={config.label} htmlFor={`product-draft-${config.name}`}>
                    <Input
                      id={`product-draft-${config.name}`}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
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
                  className={mode === 'admin' ? 'admin-step-span-2' : undefined}
                >
                  <Textarea
                    id='product-draft-3'
                    rows={3}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={1000}
                  />
                </FormField>
              )}
            </form.Field>
            {stepZeroTextFields.slice(4).map((config) => (
              <form.Field key={config.name} name={config.name}>
                {(field) => (
                  <FormField label={config.label} htmlFor={`product-draft-${config.name}`}>
                    <Input
                      id={`product-draft-${config.name}`}
                      type={config.type}
                      autoComplete={config.autoComplete}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      maxLength={config.maxLength}
                    />
                  </FormField>
                )}
              </form.Field>
            ))}
          </div>
        )}
        {step === 1 && (
          <div className={mode === 'admin' ? 'admin-step-grid' : undefined}>
            <form.Field name='name'>
              {(field) => (
                <FormField label='Tên sản phẩm (bắt buộc)' htmlFor='product-draft-4'>
                  <Input
                    id='product-draft-4'
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={255}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name='categoryId'>
              {(field) => (
                <div>
                  <FormField label='Danh mục sản phẩm (bắt buộc)' htmlFor='product-draft-5'>
                    <Select
                      value={field.state.value || ALL}
                      onValueChange={(value) => field.handleChange(value === ALL ? '' : value)}
                    >
                      <SelectTrigger id='product-draft-5' onBlur={field.handleBlur}>
                        <SelectValue placeholder='Chọn danh mục sản phẩm' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>Chọn danh mục sản phẩm</SelectItem>
                        {categories.map((item) => (
                          <SelectItem key={item.id} value={item.id} disabled={item.unavailable}>
                            {item.name}
                            {item.unavailable ? ' · Đã ngừng sử dụng' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                  {categories.some((item) => item.id === field.state.value && item.unavailable) && (
                    <p role='status' className='form-note'>
                      Danh mục của bản nháp đã ngừng sử dụng. Hồ sơ vẫn được lưu và chỉnh sửa; hãy
                      chọn danh mục đang hoạt động trước khi nộp.
                    </p>
                  )}
                </div>
              )}
            </form.Field>
            <form.Field name='description'>
              {(field) => (
                <FormField
                  label='Mô tả sản phẩm (tùy chọn)'
                  htmlFor='product-draft-6'
                  className={mode === 'admin' ? 'admin-step-span-2' : undefined}
                >
                  <Textarea
                    id='product-draft-6'
                    rows={4}
                    maxLength={10000}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </FormField>
              )}
            </form.Field>
            <form.Field name='registrationType'>
              {(field) => (
                <FormField label='Lần đăng ký đánh giá' htmlFor='product-draft-7'>
                  <Select
                    value={field.state.value || ALL}
                    onValueChange={(value) =>
                      field.handleChange(
                        (value === ALL ? '' : value) as RegistrationFormData['registrationType'],
                      )
                    }
                  >
                    <SelectTrigger id='product-draft-7' onBlur={field.handleBlur}>
                      <SelectValue placeholder='Chọn lần đăng ký' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Chọn lần đăng ký</SelectItem>
                      <SelectItem value='FIRST'>Lần đầu</SelectItem>
                      <SelectItem value='UPGRADE'>Nâng hạng</SelectItem>
                      <SelectItem value='REASSESSMENT'>Đánh giá lại</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </form.Field>
            <form.Field name='sampleQuantity'>
              {(field) => (
                <FormField label='Số lượng sản phẩm mẫu' htmlFor='product-draft-8'>
                  <Input
                    id='product-draft-8'
                    type='number'
                    min={0}
                    step={1}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </FormField>
              )}
            </form.Field>
          </div>
        )}
        {step === 2 && (
          <div className='grid gap-4'>
            <form.Field name='declarationAccepted'>
              {(field) => (
                <div
                  className='declaration-field'
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                >
                  <Checkbox
                    id='product-draft-declaration'
                    className='mt-1'
                    checked={field.state.value}
                    onBlur={field.handleBlur}
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                  />
                  <Label htmlFor='product-draft-declaration' className='cursor-pointer'>
                    Tôi cam đoan thông tin kê khai là đúng sự thật, tuân thủ quy định đánh giá, phân
                    hạng OCOP và chịu trách nhiệm về hồ sơ.
                  </Label>
                </div>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(busy) => (
                <FormField
                  label='Ảnh sản phẩm hoặc tài liệu minh chứng (tùy chọn)'
                  htmlFor='product-draft-9'
                >
                  <Input
                    id='product-draft-9'
                    ref={fileInput}
                    type='file'
                    accept={PRODUCT_FILE_ACCEPT}
                    multiple
                    disabled={busy || reviewRequired}
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                  />
                </FormField>
              )}
            </form.Subscribe>
            {files.map((file, index) => (
              <p key={`${index}:${file.name}`} className='text-sm'>
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB
              </p>
            ))}
            <p className='text-muted text-sm'>
              {(product?.attachments.length ?? 0) + files.length} / 20 tệp đã chọn hoặc lưu
            </p>
          </div>
        )}
        {error && <AlertError title='Không thể lưu bản nháp' errors={[error]} />}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(busy) => (
            <div className='hero-actions mt-4'>
              {step > 0 && (
                <Button type='button' variant='secondary' onClick={() => setStep(step - 1)}>
                  Quay lại
                </Button>
              )}
              {step < applicationSteps.length - 1 && (
                <Button type='button' onClick={() => setStep(step + 1)}>
                  Tiếp tục
                </Button>
              )}
              <Button
                type='submit'
                variant={step === applicationSteps.length - 1 ? 'primary' : 'secondary'}
                loading={busy}
                disabled={
                  busy || !canStartProductDraftSave({ reviewRequired, createOutcomeUnknown })
                }
              >
                {busy ? 'Đang lưu…' : 'Lưu bản nháp'}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
      {product && (
        <section
          aria-label='Tệp đã lưu'
          className={mode === 'admin' ? 'admin-table-region p-4' : undefined}
        >
          <p className='text-sm font-semibold'>Hồ sơ đã lưu: {product.id}</p>
          <ul className='mt-2'>
            {product.attachments.map((file) => (
              <li key={file.id}>
                <AttachmentLink
                  mode={mode}
                  productId={product.id}
                  attachmentId={file.id}
                  name={file.fileName}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
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
    </section>
  );
}
