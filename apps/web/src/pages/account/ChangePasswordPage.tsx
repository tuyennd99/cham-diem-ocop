import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '../../api';
import { ApiError, messageOf } from '../../lib/api-error';
import { setSession, validatePasswordBytes } from '../../lib/auth';

type PasswordFieldName = 'currentPassword' | 'newPassword' | 'confirmPassword';

const passwordFields: Array<{
  name: PasswordFieldName;
  label: string;
  toggleLabel: string;
  autoComplete: string;
  minLength?: number;
}> = [
  {
    name: 'currentPassword',
    label: 'Mật khẩu hiện tại',
    toggleLabel: 'mật khẩu hiện tại',
    autoComplete: 'current-password',
  },
  {
    name: 'newPassword',
    label: 'Mật khẩu mới',
    toggleLabel: 'mật khẩu mới',
    autoComplete: 'new-password',
    minLength: 8,
  },
  {
    name: 'confirmPassword',
    label: 'Nhập lại mật khẩu mới',
    toggleLabel: 'mật khẩu nhập lại',
    autoComplete: 'new-password',
    minLength: 8,
  },
];

export function ChangePasswordPage() {
  const [show, setShow] = useState<Record<PasswordFieldName, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
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
    <section className='route-panel password-page'>
      <p className='eyebrow'>TÀI KHOẢN</p>
      <h1>Đổi mật khẩu</h1>
      <p>Chọn mật khẩu mới có ít nhất 8 ký tự.</p>
      <form
        className='account-form'
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        {passwordFields.map((config) => (
          <form.Field key={config.name} name={config.name}>
            {(field) => (
              <label>
                {config.label}
                <Input
                  name={field.name}
                  type={show[config.name] ? 'text' : 'password'}
                  autoComplete={config.autoComplete}
                  minLength={config.minLength}
                  maxLength={72}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
                <button
                  type='button'
                  className='password-toggle'
                  aria-pressed={show[config.name]}
                  onClick={() =>
                    setShow((current) => ({
                      ...current,
                      [config.name]: !current[config.name],
                    }))
                  }
                >
                  {show[config.name] ? `Ẩn ${config.toggleLabel}` : `Hiện ${config.toggleLabel}`}
                </button>
              </label>
            )}
          </form.Field>
        ))}
        {error && (
          <p className='form-note' role='alert'>
            {error}
          </p>
        )}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(busy) => (
            <Button type='submit' disabled={busy}>
              {busy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
            </Button>
          )}
        </form.Subscribe>
      </form>
      <p>
        <Link className='text-link' to='/account'>
          Quay lại tài khoản
        </Link>
      </p>
    </section>
  );
}
