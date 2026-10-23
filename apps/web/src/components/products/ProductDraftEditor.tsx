import { useEffect, useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
import { omit, toString } from 'lodash';
import type { AdminUserRecord, LocalityRecord } from '@ocop/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, messageOf } from '../../lib/api-error';
import { PRODUCT_FILE_ACCEPT } from '../../lib/attachments';
import { useSession } from '../../lib/auth';
import {
  productEditorCategories,
  type ProductEditorCategory,
} from '../../lib/product-editor-categories';
import { formatCategoryPath } from '../../lib/utils';
import { hasStaffPermission } from '../../lib/session-contract';
import { canStartProductDraftSave, saveProductDraft } from '../../lib/save-product-draft';
import { useCategories, useLocalities } from '../../queries/common';
import { useAdminProductDetail, useProductDraftCommands } from '../../queries/admin-products';
import { useRegistrantOwners } from '../../queries/admin-users';
import { useMyProduct } from '../../queries/registrant';
import type {
  RegistrantProduct as Product,
  RegistrantFormData as RegistrationFormData,
} from '../../types/registrant';
import { AttachmentLink } from '../../pages/registrant/AttachmentLink';

interface ProductEditorFormValues extends RegistrationFormData {
  name: string;
  description: string;
  categoryId: string;
  localityId: string;
}

export interface ProductDraftEditorProps {
  mode: 'owner' | 'admin';
  productId?: string;
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
  { name: 'entityName', label: 'Tên chủ thể đăng ký', maxLength: 255 },
  { name: 'representativeName', label: 'Người đại diện theo pháp luật', maxLength: 255 },
  { name: 'representativeTitle', label: 'Chức danh người đại diện', maxLength: 255 },
  { name: 'phone', label: 'Số điện thoại', maxLength: 30, type: 'tel', autoComplete: 'tel' },
  { name: 'email', label: 'Email liên hệ', maxLength: 320, type: 'email', autoComplete: 'email' },
];

export function ProductDraftEditor({ mode, productId }: ProductDraftEditorProps) {
  const navigate = useNavigate();
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const categoryQuery = useCategories();
  const ownerProductQuery = useMyProduct(mode === 'owner' ? productId : undefined);
  const adminProductQuery = useAdminProductDetail('registrations', canManage, mode === 'admin' ? productId ?? '' : '');
  const queryProduct = mode === 'owner'
    ? ownerProductQuery.data
    : (adminProductQuery.data?.data as Product | undefined);
  const productError = mode === 'owner' ? ownerProductQuery.error : adminProductQuery.error;
  const productPending = Boolean(productId) &&
    (mode === 'owner' ? ownerProductQuery.isPending : adminProductQuery.isPending);
  const [localitySearch, setLocalitySearch] = useState('');
  const [localityPage, setLocalityPage] = useState(1);
  const localityQuery = useLocalities({ page: localityPage, limit: 20, q: localitySearch || undefined });
  const [categories, setCategories] = useState<ProductEditorCategory[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const createStarted = useRef(false);
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
        if (mode === 'admin' && !product && !registrantId)
          throw new Error('Chọn chủ thể đăng ký trước khi lưu hồ sơ.');
        if (mode === 'admin' && !reason.trim())
          throw new Error('Nhập lý do thao tác trước khi lưu hồ sơ.');
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
        if (mode === 'owner')
          await navigate({ to: '/my/products/$id', params: { id: result.product.id } });
        else
          await navigate({ to: '/admin/registrations/$id', params: { id: result.product.id } });
      } catch (cause) {
        const unknownCreate = createStarted.current && !product &&
          !(cause instanceof ApiError && cause.status < 500);
        setCreateOutcomeUnknown(unknownCreate);
        setError(
          unknownCreate
            ? `${messageOf(cause)} Chưa rõ hồ sơ đã được tạo chưa; kiểm tra danh sách trước khi tạo lại.`
            : messageOf(cause),
        );
      }
    },
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
      form.reset(toEditorValues(current));
      setLocalitySearch(current.locality?.code ?? '');
    } else if (!productId) {
      form.reset({ ...emptyEditorValues, categoryId: activeCategories[0]?.id ?? '' });
      setLocalitySearch('');
    }
  }, [categoryQuery.data, categoryQuery.error, categoryQuery.isPending, form, productError, productId, productPending, queryProduct]);

  if (productId && !loaded && !error) return <p>Đang tải bản nháp…</p>;
  if (productId && loaded && !product)
    return (
      <section>
        <h1>Không tìm thấy bản nháp</h1>
        <p role='alert'>{error || 'Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.'}</p>
        <Link to={mode === 'owner' ? '/my/products' : '/admin/registrations'}>Quay lại danh sách</Link>
      </section>
    );
  if (product && product.status !== 'DRAFT')
    return (
      <section>
        <h1>Hồ sơ đã nộp</h1>
        <p>Hồ sơ không còn ở trạng thái bản nháp nên không thể sửa.</p>
        <Link
          to={mode === 'owner' ? '/my/products/$id' : '/admin/registrations/$id'}
          params={{ id: product.id }}
        >
          Quay lại hồ sơ
        </Link>
      </section>
    );

  const localityOptions: LocalityRecord[] = localityQuery.data?.data ?? [];
  const currentLocalityUnavailable = Boolean(
    product?.localityId &&
      localityResolve.data &&
      !localityResolve.data.data.some(({ id }) => id === product.localityId),
  );

  return (
    <section className='route-panel'>
      <p className='eyebrow'>{mode === 'owner' ? 'KHU VỰC CHỦ THỂ · MẪU 01' : 'QUẢN TRỊ · PHIẾU ĐĂNG KÝ'}</p>
      <h1>{productId ? 'Sửa hồ sơ nháp' : mode === 'owner' ? 'Tạo hồ sơ sản phẩm' : 'Nhập hồ sơ cho chủ thể'}</h1>
      <p>
        {mode === 'owner' ? 'Hoàn thành phiếu đăng ký theo từng bước. ' : 'Nhập phiếu đăng ký cho chủ thể đã xác minh. '}
        Ảnh và tài liệu minh chứng là tùy chọn; mỗi tệp tối đa 10 MiB.
      </p>
      {mode === 'admin' && !product && (
        <fieldset className='account-form'>
          <legend>Chủ thể đăng ký</legend>
          <label>
            Tìm chủ thể đã xác minh
            <Input
              value={registrantSearch}
              onChange={(event) => {
                setRegistrantSearch(event.target.value);
                setRegistrantPage(1);
              }}
              maxLength={100}
              placeholder='Tên hoặc email'
            />
          </label>
          <label>
            Chọn chủ thể
            <select
              value={registrantId}
              onChange={(event) => {
                const selected = registrantLookup.data?.data.find(({ id }) => id === event.target.value) ?? null;
                setRegistrantId(event.target.value);
                setSelectedRegistrant(selected);
              }}
            >
              <option value=''>Chọn chủ thể</option>
              {registrantLookup.data?.data.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.fullName} · {owner.email}</option>
              ))}
            </select>
          </label>
          {selectedRegistrant && <p>{selectedRegistrant.fullName} · {selectedRegistrant.email}</p>}
          <div className='hero-actions'>
            <Button variant='secondary' type='button' disabled={registrantPage <= 1} onClick={() => setRegistrantPage((page) => page - 1)}>Trước</Button>
            <span>Trang {registrantPage} / {registrantLookup.data?.meta?.totalPages ?? 1}</span>
            <Button variant='secondary' type='button' disabled={registrantPage >= (registrantLookup.data?.meta?.totalPages ?? 1)} onClick={() => setRegistrantPage((page) => page + 1)}>Sau</Button>
          </div>
        </fieldset>
      )}
      {mode === 'admin' && product && (
        <p>Chủ thể: {adminProductQuery.data?.data.registrant.fullName} · {adminProductQuery.data?.data.registrant.email}</p>
      )}
      {mode === 'admin' && (
        <label>
          Lý do thao tác
          <Input value={reason} maxLength={255} onChange={(event) => setReason(event.target.value)} required />
        </label>
      )}
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
      <form
        className='account-form'
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <h2>
          Bước {step + 1} · {applicationSteps[step]}
        </h2>
        {step === 0 && (
          <>
            <form.Field name='localityId'>
              {(field) => (
                <>
                  <label>
                    Địa bàn hành chính
                    <Input
                      value={localitySearch}
                      onChange={(event) => {
                        setLocalitySearch(event.target.value);
                        setLocalityPage(1);
                      }}
                      placeholder='Tìm xã/phường hoặc tỉnh/thành'
                      maxLength={100}
                    />
                    <select
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    >
                      <option value=''>Chưa chọn địa bàn</option>
                      {product?.localityId && !localityOptions.some(({ id }) => id === product.localityId) && (
                        <option value={product.localityId} disabled={currentLocalityUnavailable}>
                          {product.locality
                            ? `${product.locality.name} · ${product.locality.provinceName}`
                            : product.localityId}
                          {currentLocalityUnavailable ? ' · Đã ngừng hiệu lực' : ''}
                        </option>
                      )}
                      {localityOptions.map((locality) => (
                        <option key={locality.id} value={locality.id}>
                          {locality.name} · {locality.provinceName}
                        </option>
                      ))}
                    </select>
                  </label>
                  {currentLocalityUnavailable && (
                    <p role='status' className='form-note'>
                      Địa bàn đã ngừng hoạt động hoặc hết hiệu lực. Bản nháp vẫn giữ lựa chọn; hãy chọn địa bàn đang hiệu lực trước khi nộp.
                    </p>
                  )}
                  {!field.state.value && (
                    <p className='form-note'>Có thể lưu nháp khi chưa chọn địa bàn; cần chọn địa bàn hiệu lực trước khi nộp.</p>
                  )}
                  <div className='hero-actions'>
                    <Button variant='secondary' type='button' disabled={localityPage <= 1} onClick={() => setLocalityPage((page) => page - 1)}>Trước</Button>
                    <span>Trang {localityPage} / {localityQuery.data?.meta?.totalPages ?? 1}</span>
                    <Button variant='secondary' type='button' disabled={localityPage >= (localityQuery.data?.meta?.totalPages ?? 1)} onClick={() => setLocalityPage((page) => page + 1)}>Sau</Button>
                  </div>
                </>
              )}
            </form.Field>
            <form.Field name='provinceName'>
              {(field) => (
                <label>
                  Tỉnh/thành phố đăng ký
                  <Input
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={100}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name='assessmentYear'>
              {(field) => (
                <label>
                  Năm đăng ký
                  <Input
                    type='number'
                    min={2020}
                    max={2100}
                    step={1}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </label>
              )}
            </form.Field>
            {stepZeroTextFields.slice(1, 4).map((config) => (
              <form.Field key={config.name} name={config.name}>
                {(field) => (
                  <label>
                    {config.label}
                    <Input
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      maxLength={config.maxLength}
                    />
                  </label>
                )}
              </form.Field>
            ))}
            <form.Field name='contactAddress'>
              {(field) => (
                <label>
                  Địa chỉ liên hệ
                  <textarea
                    rows={3}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={1000}
                  />
                </label>
              )}
            </form.Field>
            {stepZeroTextFields.slice(4).map((config) => (
              <form.Field key={config.name} name={config.name}>
                {(field) => (
                  <label>
                    {config.label}
                    <Input
                      type={config.type}
                      autoComplete={config.autoComplete}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                      maxLength={config.maxLength}
                    />
                  </label>
                )}
              </form.Field>
            ))}
          </>
        )}
        {step === 1 && (
          <>
            <form.Field name='name'>
              {(field) => (
                <label>
                  Tên sản phẩm
                  <Input
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    maxLength={255}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name='categoryId'>
              {(field) => (
                <>
                  <label>
                    Ngành, nhóm, phân nhóm sản phẩm
                    <select
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    >
                      <option value=''>Chọn phân loại sản phẩm</option>
                      {categories.map((item) => (
                        <option key={item.id} value={item.id} disabled={item.unavailable}>
                          {formatCategoryPath([
                            item.groupName,
                            item.classificationGroup,
                            item.classificationSubgroup,
                          ])}
                          {item.unavailable ? ' · Đã ngừng sử dụng' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {categories.some((item) => item.id === field.state.value && item.unavailable) && (
                    <p role='status' className='form-note'>
                      Danh mục của bản nháp đã ngừng sử dụng. Hồ sơ vẫn được lưu và chỉnh sửa; hãy
                      chọn danh mục đang hoạt động trước khi nộp.
                    </p>
                  )}
                </>
              )}
            </form.Field>
            <form.Field name='description'>
              {(field) => (
                <label>
                  Mô tả
                  <textarea
                    rows={4}
                    maxLength={10000}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name='registrationType'>
              {(field) => (
                <label>
                  Lần đăng ký đánh giá
                  <select
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) =>
                      field.handleChange(
                        event.target.value as RegistrationFormData['registrationType'],
                      )
                    }
                  >
                    <option value=''>Chọn lần đăng ký</option>
                    <option value='FIRST'>Lần đầu</option>
                    <option value='UPGRADE'>Nâng hạng</option>
                    <option value='REASSESSMENT'>Đánh giá lại</option>
                  </select>
                </label>
              )}
            </form.Field>
            <form.Field name='sampleQuantity'>
              {(field) => (
                <label>
                  Số lượng sản phẩm mẫu
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </label>
              )}
            </form.Field>
          </>
        )}
        {step === 2 && (
          <>
            <form.Field name='declarationAccepted'>
              {(field) => (
                <label
                  className='declaration-field'
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
                >
                  <input
                    type='checkbox'
                    style={{ width: 'auto', minHeight: 'auto', padding: 0, marginTop: 4 }}
                    checked={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.checked)}
                  />
                  <span>
                    Tôi cam đoan thông tin kê khai là đúng sự thật, tuân thủ quy định đánh giá, phân
                    hạng OCOP và chịu trách nhiệm về hồ sơ.
                  </span>
                </label>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(busy) => (
                <label>
                  Ảnh sản phẩm hoặc tài liệu minh chứng (không bắt buộc)
                  <Input
                    ref={fileInput}
                    type='file'
                    accept={PRODUCT_FILE_ACCEPT}
                    multiple
                    disabled={busy || reviewRequired}
                    onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                  />
                </label>
              )}
            </form.Subscribe>
            {files.map((file, index) => (
                <p key={`${index}:${file.name}`}>
                  {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB
                </p>
              ))}
            <p>{(product?.attachments.length ?? 0) + files.length} / 20 tệp đã chọn hoặc lưu</p>
          </>
        )}
        {error && (
          <p role='alert' className='form-note'>
            {error}
          </p>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(busy) => (
            <div className='hero-actions'>
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
                variant='secondary'
                disabled={busy || !canStartProductDraftSave({ reviewRequired, createOutcomeUnknown })}
              >
                {busy ? 'Đang lưu…' : 'Lưu bản nháp'}
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
      {product && (
        <section aria-label='Tệp đã lưu'>
          <p>Hồ sơ đã lưu: {product.id}</p>
          <ul>
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
          {reviewRequired ? 'Hãy kiểm tra tệp đã nhận trước khi chọn lại.' : 'Có thể thử lại các tệp còn lại hoặc kiểm tra hồ sơ.'}{' '}
          {mode === 'owner' ? (
            <Link className='text-link' to='/my/products/$id' params={{ id: uploadFailureId }}>Mở hồ sơ và danh sách tệp</Link>
          ) : (
            <Link className='text-link' to='/admin/registrations/$id' params={{ id: uploadFailureId }}>Mở hồ sơ và danh sách tệp</Link>
          )}
        </p>
      )}
      {createOutcomeUnknown && (
        <p className='form-note'>
          {mode === 'owner' ? (
            <Link className='text-link' to='/my/products'>Mở danh sách nháp trước khi tạo lại</Link>
          ) : (
            <Link className='text-link' to='/admin/registrations'>Mở danh sách hồ sơ trước khi tạo lại</Link>
          )}
        </p>
      )}
    </section>
  );
}
