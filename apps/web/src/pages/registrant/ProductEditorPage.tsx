import { useEffect, useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { omit, toString } from 'lodash';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { myProductsApi, productsApi } from '../../api';
import { queryKeys } from '../../constants/query-key';
import { ApiError, messageOf } from '../../lib/api-error';
import { PRODUCT_FILE_ACCEPT, validateProductFile } from '../../lib/attachments';
import {
  productEditorCategories,
  type ProductEditorCategory,
} from '../../lib/product-editor-categories';
import { formatCategoryPath } from '../../lib/utils';
import type {
  RegistrantProduct as Product,
  RegistrantFormData as RegistrationFormData,
} from '../../types/registrant';
import { AttachmentLink } from './AttachmentLink';

interface ProductEditorFormValues extends RegistrationFormData {
  name: string;
  description: string;
  categoryId: string;
}

const currentYear = String(new Date().getFullYear());

const emptyEditorValues: ProductEditorFormValues = {
  name: '',
  description: '',
  categoryId: '',
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

export function ProductEditorPage({ productId }: { productId?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<ProductEditorCategory[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<FileList | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState('');

  const form = useForm({
    defaultValues: emptyEditorValues,
    onSubmit: async ({ value }) => {
      setError('');
      try {
        const selectedFiles = Array.from(files ?? []);
        for (const file of selectedFiles) validateProductFile(file);
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
        const registrationFields = omit(value, ['name', 'description', 'categoryId']);
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
          formData,
        };
        const existingId = productId ?? product?.id;
        const { data } = existingId
          ? await myProductsApi.update(existingId, payload)
          : await myProductsApi.create(payload);
        const targetId = existingId ?? data.id;
        setProduct(data);
        const uploaded = new Set(uploadedFiles);
        for (const file of selectedFiles) {
          const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
          if (uploaded.has(fileKey)) continue;
          try {
            const { data: attachment } = await myProductsApi.upload(targetId, file);
            uploaded.add(fileKey);
            setUploadedFiles(new Set(uploaded));
            setProduct((current) =>
              current ? { ...current, attachments: [...current.attachments, attachment] } : current,
            );
          } catch (cause) {
            if (!(cause instanceof ApiError) || cause.status >= 500) {
              setFiles(null);
              if (fileInput.current) fileInput.current.value = '';
              try {
                const { data: latest } = await myProductsApi.detail(targetId);
                setProduct(latest);
              } catch (refreshCause) {
                throw new Error(
                  `Chưa xác nhận tải tệp ${file.name}; chưa tải lại được hồ sơ. ${messageOf(refreshCause)} Hãy mở hồ sơ kiểm tra trước khi chọn lại tệp.`,
                );
              }
              throw new Error(
                `Chưa xác nhận tải tệp ${file.name}. Đã tải lại danh sách tệp đã lưu; hãy kiểm tra trước khi chọn lại tệp.`,
              );
            }
            throw cause;
          }
        }
        await queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.all });
        await navigate({ to: '/my/products/$id', params: { id: targetId } });
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
  });

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError('');
    setProduct(null);
    Promise.all([
      productsApi.categories(),
      productId ? myProductsApi.detail(productId) : Promise.resolve({ data: null }),
    ])
      .then(([categoryResult, productResult]) => {
        if (!active) return;
        const current = productResult.data;
        setCategories(productEditorCategories(categoryResult.data, current));
        if (current) {
          setProduct(current);
          form.reset(toEditorValues(current));
        } else if (!productId) {
          form.reset({
            ...emptyEditorValues,
            categoryId: categoryResult.data[0]?.id ?? '',
          });
        }
      })
      .catch((cause) => {
        if (active) setError(messageOf(cause));
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [productId, form]);

  if (productId && !loaded && !error) return <p>Đang tải bản nháp…</p>;
  if (productId && loaded && !product)
    return (
      <section>
        <h1>Không tìm thấy bản nháp</h1>
        <p role='alert'>{error || 'Hồ sơ không tồn tại hoặc bạn không có quyền truy cập.'}</p>
        <Link to='/my/products'>Quay lại danh sách</Link>
      </section>
    );
  if (product && product.status !== 'DRAFT')
    return (
      <section>
        <h1>Hồ sơ đã nộp</h1>
        <p>Hồ sơ không còn ở trạng thái bản nháp nên không thể sửa.</p>
        <Link to='/my/products/$id' params={{ id: product.id }}>
          Quay lại hồ sơ
        </Link>
      </section>
    );

  return (
    <section className='route-panel'>
      <p className='eyebrow'>KHU VỰC CHỦ THỂ · MẪU 01</p>
      <h1>{productId ? 'Sửa hồ sơ nháp' : 'Tạo hồ sơ sản phẩm'}</h1>
      <p>
        Hoàn thành phiếu đăng ký theo từng bước. Ảnh và tài liệu minh chứng là tùy chọn; mỗi tệp tối
        đa 10 MiB.
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
                    disabled={busy}
                    onChange={(event) => setFiles(event.target.files)}
                  />
                </label>
              )}
            </form.Subscribe>
            {files &&
              Array.from(files).map((file) => (
                <p key={`${file.name}:${file.lastModified}`}>
                  {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB
                </p>
              ))}
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
              <Button type='submit' variant='secondary' disabled={busy}>
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
                  productId={product.id}
                  attachmentId={file.id}
                  name={file.fileName}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
