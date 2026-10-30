import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link, useNavigate } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '../../api';
import { messageOf } from '../../lib/api-error';
import { homeFor, setSession } from '../../lib/auth';
import { AuthFrame } from './AuthFrame';

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  const form = useForm({
    defaultValues: { email: '', password: 'OcopTest@2026!' },
    onSubmit: async ({ value }) => {
      setError('');
      try {
        const { data } = await authApi.login(value);
        setSession({ accessToken: data.accessToken, user: data.user });
        await navigate({ to: homeFor(data.user.role, data.user.staffPermissions) });
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
  });

  const loginAside = (
    <aside className='auth-aside' aria-label='Phân quyền hệ thống'>
      <p className='eyebrow'>KHU VỰC HỆ THỐNG</p>
      <h2>Làm việc theo vai trò được phân quyền</h2>
      <p className='auth-aside-lead'>
        Hệ thống tự động chuyển hướng tới không gian làm việc tương ứng ngay sau khi đăng nhập thành
        công:
      </p>
      <ol className='auth-steps'>
        <li className='auth-step'>
          <span className='step-number'>VAI TRÒ · NGƯỜI ĐĂNG KÝ</span>
          <h3>Người đăng ký (hợp tác xã, hộ kinh doanh, doanh nghiệp)</h3>
          <p>
            Quản lý danh mục sản phẩm của đơn vị, tạo hồ sơ mới, tải lên tài liệu minh chứng và xem
            phiếu tổng hợp điểm.
          </p>
        </li>
        <li className='auth-step'>
          <span className='step-number'>VAI TRÒ · GIÁM KHẢO</span>
          <h3>Giám khảo hội đồng chấm điểm</h3>
          <p>
            Truy cập danh sách hồ sơ được phân công, đối chiếu minh chứng và chấm điểm từng tiêu chí
            theo Quyết định 26/2026/QĐ-TTg.
          </p>
        </li>
        <li className='auth-step'>
          <span className='step-number'>VAI TRÒ · QUẢN TRỊ</span>
          <h3>Quản trị viên hệ thống</h3>
          <p>
            Tiếp nhận hồ sơ, phân công giám khảo theo nhóm tiêu chí và công bố kết quả xếp hạng sản
            phẩm OCOP.
          </p>
        </li>
      </ol>
      <div className='auth-aside-meta'>
        <div>
          <strong>Cần kích hoạt tài khoản mới?</strong>
          <span>
            Nếu vừa đăng ký nhưng chưa nhập mã OTP 6 chữ số, hãy chuyển tới trang{' '}
            <Link className='text-link' to='/verify-otp'>
              Xác thực email
            </Link>
            .
          </span>
        </div>
      </div>
    </aside>
  );

  return (
    <AuthFrame
      eyebrow='TÀI KHOẢN OCOP'
      title='Đăng nhập'
      intro='Dùng email đã xác thực để tiếp tục làm việc với hồ sơ sản phẩm hoặc hội đồng chấm điểm.'
      mode='login'
      aside={loginAside}
    >
      <form
        className='account-form'
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name='email'>
          {(field) => (
            <FormField label='Email' htmlFor={`login-${field.name}`}>
              <Input
                id={`login-${field.name}`}
                name={field.name}
                type='email'
                autoComplete='email'
                placeholder='Ví dụ: lienhe@htxcheshan.vn'
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
              />
            </FormField>
          )}
        </form.Field>
        <form.Field name='password'>
          {(field) => (
            <FormField label='Mật khẩu' htmlFor={`login-${field.name}`}>
              <PasswordInput
                id={`login-${field.name}`}
                name={field.name}
                autoComplete='current-password'
                placeholder='Nhập mật khẩu của bạn'
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
              />
            </FormField>
          )}
        </form.Field>
        {error && <AlertError title='Không thể đăng nhập' errors={[error]} />}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(busy) => (
            <Button type='submit' className='auth-submit-btn' loading={busy} disabled={busy}>
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          )}
        </form.Subscribe>
      </form>
      <div className='auth-card-footer'>
        <div className='auth-help-links'>
          <Link className='text-link' to='/forgot-password'>
            Quên mật khẩu?
          </Link>
          <Link className='text-link' to='/verify-otp'>
            Cần xác thực email?
          </Link>
        </div>
        <p className='auth-switch-prompt'>
          Chưa có tài khoản?{' '}
          <Link className='text-link' to='/register'>
            Đăng ký
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
}
