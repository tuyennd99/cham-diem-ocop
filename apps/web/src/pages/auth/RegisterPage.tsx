import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import { GoogleSignIn } from '@/components/google-sign-in';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '../../api';
import { ApiError, messageOf } from '../../lib/api-error';
import { validatePasswordBytes } from '../../lib/auth';
import { normalizeEmail, optionalText } from '../../lib/utils';
import { AuthFrame } from './AuthFrame';
import { clearPendingEmail, writePendingEmail } from './pending-email';

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const form = useForm({
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
    onSubmit: async ({ value }) => {
      clearPendingEmail();
      setError('');
      const emailValue = normalizeEmail(value.email);
      try {
        validatePasswordBytes(value.password);
        const { data } = await authApi.register({
          email: emailValue,
          fullName: value.fullName,
          phone: optionalText(value.phone),
          password: value.password,
        });
        writePendingEmail({ ...data, mode: 'register' });
        await navigate({ to: '/verify-otp', search: {} });
      } catch (cause) {
        setError(
          cause instanceof ApiError && cause.status === 409
            ? 'Email này đã được dùng. Vui lòng đăng nhập.'
            : messageOf(cause),
        );
      }
    },
  });

  const registerAside = (
    <aside className='auth-aside' aria-label='Hướng dẫn đăng ký tài khoản người đăng ký'>
      <p className='eyebrow'>HƯỚNG DẪN NGƯỜI ĐĂNG KÝ</p>
      <h2>3 bước chuẩn bị và nộp hồ sơ OCOP</h2>
      <p className='auth-aside-lead'>
        Tài khoản người đăng ký giúp hợp tác xã, doanh nghiệp và hộ sản xuất lưu trữ hồ sơ trực
        tuyến và theo dõi kết quả chấm điểm minh bạch.
      </p>
      <ol className='auth-steps'>
        <li className='auth-step'>
          <span className='step-number'>BƯỚC 01 · KÍCH HOẠT</span>
          <h3>Xác thực email nhận thông báo</h3>
          <p>
            Sau khi gửi biểu mẫu đăng ký, nhập mã gồm 6 chữ số được gửi tới hộp thư để kích hoạt tài
            khoản người đăng ký.
          </p>
        </li>
        <li className='auth-step'>
          <span className='step-number'>BƯỚC 02 · KHAI BÁO HỒ SƠ</span>
          <h3>Lập hồ sơ &amp; đính kèm minh chứng</h3>
          <p>
            Khai báo thông tin sản phẩm, xuất xứ địa phương, câu chuyện sản phẩm và tải lên tài liệu
            minh chứng theo từng nhóm tiêu chí.
          </p>
        </li>
        <li className='auth-step'>
          <span className='step-number'>BƯỚC 03 · TRA CỨU KẾT QUẢ</span>
          <h3>Theo dõi tiến độ chấm điểm và sao đạt</h3>
          <p>
            Xem trạng thái tiếp nhận, điểm chi tiết theo Quyết định 26/2026/QĐ-TTg (thang 100 điểm)
            và mức xếp hạng từ 1 đến 5 sao.
          </p>
        </li>
      </ol>
      <div className='auth-aside-meta'>
        <div>
          <strong>Căn cứ áp dụng</strong>
          <span>
            Bộ tiêu chí đánh giá, phân hạng sản phẩm OCOP theo Quyết định số 26/2026/QĐ-TTg.
          </span>
        </div>
        <Link className='text-link' to='/products'>
          Xem danh sách hồ sơ công khai →
        </Link>
      </div>
    </aside>
  );

  return (
    <AuthFrame
      eyebrow='TÀI KHOẢN OCOP'
      title='Đăng ký tài khoản'
      intro='Tạo tài khoản người đăng ký để lập và gửi hồ sơ sản phẩm OCOP.'
      mode='register'
      aside={registerAside}
    >
      <GoogleSignIn intent='register' />
      <form
        className='account-form'
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name='fullName'>
          {(field) => (
            <FormField
              label='Tên người đăng ký hoặc đơn vị'
              hint='Ghi đúng tên hợp tác xã, doanh nghiệp hoặc hộ sản xuất kinh doanh trên giấy phép.'
              htmlFor={`register-${field.name}`}
            >
              <Input
                id={`register-${field.name}`}
                name={field.name}
                autoComplete='organization'
                placeholder='Ví dụ: Hợp tác xã Chè Shan Tuyết Pà Cò'
                maxLength={255}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-describedby={`register-${field.name}-hint`}
                required
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name='email'>
          {(field) => (
            <FormField
              label='Email'
              hint='Hệ thống sẽ gửi mã OTP gồm 6 chữ số tới địa chỉ email này để kích hoạt tài khoản.'
              htmlFor={`register-${field.name}`}
            >
              <Input
                id={`register-${field.name}`}
                name={field.name}
                type='email'
                autoComplete='email'
                placeholder='Ví dụ: lienhe@htxcheshan.vn'
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-describedby={`register-${field.name}-hint`}
                required
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name='phone'>
          {(field) => (
            <FormField
              label='Số điện thoại'
              optional='(không bắt buộc)'
              hint='Dùng để hội đồng chấm điểm liên hệ khi cần đối chiếu bổ sung hồ sơ minh chứng.'
              htmlFor={`register-${field.name}`}
            >
              <Input
                id={`register-${field.name}`}
                name={field.name}
                type='tel'
                autoComplete='tel'
                placeholder='Ví dụ: 0912 345 678'
                maxLength={30}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-describedby={`register-${field.name}-hint`}
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name='password'>
          {(field) => (
            <FormField
              label='Mật khẩu'
              hint='Tối thiểu 8 ký tự (tối đa 72 ký tự).'
              htmlFor={`register-${field.name}`}
            >
              <PasswordInput
                id={`register-${field.name}`}
                name={field.name}
                autoComplete='new-password'
                placeholder='Nhập mật khẩu từ 8 ký tự trở lên'
                minLength={8}
                maxLength={72}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-describedby={`register-${field.name}-hint`}
                required
              />
            </FormField>
          )}
        </form.Field>
        {error && (
          <div className='space-y-2'>
            <AlertError title='Không thể hoàn tất đăng ký' errors={[error]} />
            <p className='text-sm'>
              <Link className='text-link' to='/verify-otp'>
                Xác thực email hoặc gửi lại mã →
              </Link>
            </p>
          </div>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(busy) => (
            <Button type='submit' className='auth-submit-btn' loading={busy} disabled={busy}>
              {busy ? 'Đang gửi…' : 'Gửi mã xác thực'}
            </Button>
          )}
        </form.Subscribe>
      </form>
      <div className='auth-card-footer'>
        <p className='auth-switch-prompt'>
          Đã có tài khoản?{' '}
          <Link className='text-link' to='/login'>
            Đăng nhập
          </Link>
        </p>
        <div className='auth-help-links'>
          <Link className='text-link' to='/verify-otp'>
            Đã đăng ký nhưng chưa nhập mã OTP? Xác thực email
          </Link>
        </div>
      </div>
    </AuthFrame>
  );
}
