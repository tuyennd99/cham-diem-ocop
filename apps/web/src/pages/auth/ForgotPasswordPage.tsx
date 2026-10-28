import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '../../api';
import { messageOf } from '../../lib/api-error';
import { validatePasswordBytes } from '../../lib/auth';
import { normalizeEmail } from '../../lib/utils';
import { AuthFrame } from './AuthFrame';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const sendCodeForm = useForm({
    defaultValues: { email: '' },
    onSubmit: async ({ value }) => {
      setError('');
      const normalized = normalizeEmail(value.email);
      try {
        const { data } = await authApi.forgotPassword(normalized);
        setEmail(normalized);
        setNotice(data.message);
        setSent(true);
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
  });

  const resetForm = useForm({
    defaultValues: { code: '', password: '' },
    onSubmit: async ({ value }) => {
      setError('');
      try {
        validatePasswordBytes(value.password);
        await authApi.resetPassword({
          email,
          code: value.code,
          newPassword: value.password,
        });
        setNotice('Đã đổi mật khẩu. Bạn có thể đăng nhập.');
        setSent(false);
        resetForm.reset();
      } catch (cause) {
        setError(messageOf(cause));
      }
    },
  });

  return (
    <AuthFrame
      eyebrow='KHÔI PHỤC TÀI KHOẢN'
      title='Quên mật khẩu'
      intro={
        sent
          ? `Nhập mã trong email gửi tới ${email} và đặt mật khẩu mới.`
          : 'Nhận mã xác thực qua email để đặt lại mật khẩu.'
      }
      backTo='/login'
      backLabel='Quay lại trang đăng nhập'
    >
      {!sent ? (
        <form
          className='account-form'
          onSubmit={(event) => {
            event.preventDefault();
            void sendCodeForm.handleSubmit();
          }}
        >
          <sendCodeForm.Field name='email'>
            {(field) => (
              <FormField label='Email' htmlFor={`forgot-password-${field.name}`}>
                <Input
                  id={`forgot-password-${field.name}`}
                  name={field.name}
                  type='email'
                  autoComplete='email'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
              </FormField>
            )}
          </sendCodeForm.Field>
          {notice && (
            <p className='form-note' role='status'>
              {notice}
            </p>
          )}
          {error && <AlertError title='Không thể gửi mã xác thực' errors={[error]} />}
          <sendCodeForm.Subscribe selector={(state) => state.isSubmitting}>
            {(busy) => (
              <Button type='submit' className='auth-submit-btn' loading={busy} disabled={busy}>
                {busy ? 'Đang gửi…' : 'Gửi mã xác thực'}
              </Button>
            )}
          </sendCodeForm.Subscribe>
        </form>
      ) : (
        <form
          className='account-form'
          onSubmit={(event) => {
            event.preventDefault();
            void resetForm.handleSubmit();
          }}
        >
          <resetForm.Field name='code'>
            {(field) => (
              <FormField label='Mã OTP' htmlFor={`forgot-password-${field.name}`}>
                <Input
                  id={`forgot-password-${field.name}`}
                  name={field.name}
                  className='otp-code-input'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  pattern='[0-9]{6}'
                  maxLength={6}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
              </FormField>
            )}
          </resetForm.Field>
          <resetForm.Field name='password'>
            {(field) => (
              <FormField label='Mật khẩu mới' htmlFor={`forgot-password-${field.name}`}>
                <PasswordInput
                  id={`forgot-password-${field.name}`}
                  name={field.name}
                  autoComplete='new-password'
                  minLength={8}
                  maxLength={72}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
              </FormField>
            )}
          </resetForm.Field>
          {error && <AlertError title='Không thể đặt lại mật khẩu' errors={[error]} />}
          <resetForm.Subscribe selector={(state) => state.isSubmitting}>
            {(busy) => (
              <Button type='submit' className='auth-submit-btn' loading={busy} disabled={busy}>
                {busy ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
              </Button>
            )}
          </resetForm.Subscribe>
        </form>
      )}
    </AuthFrame>
  );
}
