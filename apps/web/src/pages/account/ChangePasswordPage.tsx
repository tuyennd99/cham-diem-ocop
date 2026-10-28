import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { authApi } from '../../api';
import { ApiError, messageOf } from '../../lib/api-error';
import { setSession, validatePasswordBytes } from '../../lib/auth';

type PasswordFieldName = 'currentPassword' | 'newPassword' | 'confirmPassword';

const passwordFields: Array<{
  name: PasswordFieldName;
  label: string;
  autoComplete: string;
  minLength?: number;
}> = [
  {
    name: 'currentPassword',
    label: 'Mật khẩu hiện tại',
    autoComplete: 'current-password',
  },
  {
    name: 'newPassword',
    label: 'Mật khẩu mới',
    autoComplete: 'new-password',
    minLength: 8,
  },
  {
    name: 'confirmPassword',
    label: 'Nhập lại mật khẩu mới',
    autoComplete: 'new-password',
    minLength: 8,
  },
];

export function ChangePasswordPage() {
  const [error, setError] = useState('');

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    onSubmit: async ({ value }) => {
      setError('');
      if (value.newPassword.length < 8) {
        setError('Mật khẩu mới cần có ít nhất 8 ký tự.');
        return;
      }
      if (value.newPassword !== value.confirmPassword) {
        setError('Mật khẩu nhập lại chưa khớp.');
        return;
      }
      try {
        validatePasswordBytes(value.currentPassword);
        validatePasswordBytes(value.newPassword);
        await authApi.changePassword({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
        });
        form.reset();
        setSession(null);
        window.location.replace('/login');
      } catch (cause) {
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'Mật khẩu hiện tại không đúng.'
            : messageOf(cause),
        );
      }
    },
  });

  return (
    <section className='admin-page'>
      <div>
        <Link className='text-link text-sm' to='/account'>
          ← Quay lại thông tin tài khoản
        </Link>
      </div>

      <div className='admin-page-heading'>
        <div>
          <h1>Đổi mật khẩu</h1>
          <p className='route-intro'>
            Chọn mật khẩu mới có ít nhất 8 ký tự (tối đa 72 byte UTF-8). Sau khi đổi mật khẩu thành
            công, bạn sẽ cần đăng nhập lại.
          </p>
        </div>
      </div>

      <form
        className='admin-form account-form filter-card'
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {passwordFields.map((config) => (
          <form.Field key={config.name} name={config.name}>
            {(field) => (
              <FormField
                label={<span>{config.label}</span>}
                htmlFor={`account-password-${config.name}`}
              >
                <PasswordInput
                  id={`account-password-${config.name}`}
                  name={field.name}
                  autoComplete={config.autoComplete}
                  minLength={config.minLength}
                  maxLength={72}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
              </FormField>
            )}
          </form.Field>
        ))}
        {error && <AlertError title='Không thể cập nhật mật khẩu' errors={[error]} />}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(busy) => (
            <div className='admin-actions'>
              <Button type='submit' loading={busy} disabled={busy}>
                {busy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
              </Button>
              <Button asChild variant='secondary'>
                <Link to='/account'>Hủy</Link>
              </Button>
            </div>
          )}
        </form.Subscribe>
      </form>
    </section>
  );
}
