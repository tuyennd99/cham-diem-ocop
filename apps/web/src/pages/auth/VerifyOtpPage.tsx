import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '../../api';
import { messageOf } from '../../lib/api-error';
import { normalizeEmail } from '../../lib/utils';
import { AuthFrame } from './AuthFrame';
import { clearPendingEmail, readPendingEmail, writePendingEmail } from './pending-email';

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const [initialEmail] = useState(() => readPendingEmail());
  const [cooldownEmail, setCooldownEmail] = useState(() => initialEmail);
  const [secondsLeft, setSecondsLeft] = useState(() => (initialEmail ? 60 : 0));
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const verifyForm = useForm({
    defaultValues: { email: initialEmail, code: '' },
    onSubmit: async ({ value }) => {
      setError('');
      setNotice('');
      setEmailError('');
      setCodeError('');
      const normalizedEmail = normalizeEmail(value.email);
      if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setEmailError('Nhập địa chỉ email hợp lệ dùng khi đăng ký.');
        return;
      }
      if (!/^\d{6}$/.test(value.code)) {
        setCodeError('Mã xác thực gồm đúng 6 chữ số.');
        return;
      }
      try {
        await authApi.verifyOtp({ email: normalizedEmail, code: value.code });
        clearPendingEmail();
        setSuccess(true);
      } catch (cause) {
        const message = messageOf(cause);
        if (/otp|code|mã|hết hạn|expired|invalid/i.test(message)) {
          setCodeError('Mã không đúng hoặc đã hết hạn. Hãy kiểm tra email hoặc gửi mã mới.');
        } else {
          setError(message);
        }
      }
    },
  });

  async function resend() {
    const currentEmail = normalizeEmail(verifyForm.state.values.email);
    setEmailError('');
    setError('');
    setNotice('');
    if (!currentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
      setEmailError('Nhập địa chỉ email hợp lệ để nhận mã xác thực.');
      return;
    }
    const isSameCooldownEmail = currentEmail === cooldownEmail && secondsLeft > 0;
    if (isSameCooldownEmail || verifyForm.state.isSubmitting || resending) return;

    setResending(true);
    try {
      await authApi.resendOtp(currentEmail);
      verifyForm.setFieldValue('email', currentEmail);
      writePendingEmail(currentEmail);
      setCooldownEmail(currentEmail);
      setSecondsLeft(60);
      setNotice('Nếu email có đăng ký đang chờ xác thực, mã OTP mới đã được gửi tới hộp thư.');
    } catch {
      setError('Chưa thể gửi mã lúc này. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthFrame
      eyebrow='TÀI KHOẢN OCOP'
      title='Xác thực email'
      intro='Nhập mã OTP gồm 6 chữ số được gửi tới hộp thư để kích hoạt tài khoản người đăng ký.'
      backTo='/login'
      backLabel='Quay lại trang đăng nhập'
    >
      {success ? (
        <div className='auth-success' role='status' aria-live='polite'>
          <div className='auth-status-banner'>
            <CheckCircle2 className='size-5 shrink-0' aria-hidden='true' />
            <div>
              <strong>Email đã được xác thực thành công</strong>
              <p>Tài khoản người đăng ký đã sẵn sàng. Tiếp tục đăng nhập để tạo và quản lý hồ sơ OCOP.</p>
            </div>
          </div>
          <Button
            type='button'
            className='auth-submit-btn'
            onClick={() => void navigate({ to: '/login' })}
          >
            Đến trang đăng nhập
          </Button>
        </div>
      ) : (
        <form
          className='account-form'
          onSubmit={(event) => {
            event.preventDefault();
            void verifyForm.handleSubmit();
          }}
        >
          <verifyForm.Field name='email'>
            {(field) => (
              <FormField
                label='Email nhận mã'
                hint='Nhập đúng email đã đăng ký. Bạn có thể chỉnh sửa lại nếu cần gửi mã tới email khác.'
                htmlFor={`verify-otp-${field.name}`}
              >
                <Input
                  id={`verify-otp-${field.name}`}
                  name={field.name}
                  type='email'
                  autoComplete='email'
                  placeholder='Ví dụ: lienhe@htxcheshan.vn'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    if (emailError) setEmailError('');
                  }}
                  aria-invalid={Boolean(emailError)}
                  aria-describedby={
                    emailError
                      ? `otp-email-error verify-otp-${field.name}-hint`
                      : `verify-otp-${field.name}-hint`
                  }
                  required
                />
              </FormField>
            )}
          </verifyForm.Field>
          <InputError id='otp-email-error' role='alert' message={emailError} />
          <verifyForm.Field name='code'>
            {(field) => (
              <FormField
                label='Mã xác thực OTP'
                optional='6 chữ số'
                hint='Nhập hoặc dán trực tiếp mã 6 chữ số từ email (kiểm tra thêm mục Thư rác nếu chưa thấy).'
                htmlFor={`verify-otp-${field.name}`}
              >
                <Input
                  id={`verify-otp-${field.name}`}
                  name={field.name}
                  className='otp-code-input'
                  type='text'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                  pattern='[0-9]{6}'
                  maxLength={6}
                  placeholder='000000'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value.replace(/\D/g, '').slice(0, 6));
                    if (codeError) setCodeError('');
                  }}
                  aria-invalid={Boolean(codeError)}
                  aria-describedby={
                    codeError
                      ? `otp-code-error verify-otp-${field.name}-hint`
                      : `verify-otp-${field.name}-hint`
                  }
                  required
                />
              </FormField>
            )}
          </verifyForm.Field>
          <InputError id='otp-code-error' role='alert' message={codeError} />
          {notice && (
            <div className='auth-status-banner' role='status' aria-live='polite'>
              <CheckCircle2 className='size-4 shrink-0' aria-hidden='true' />
              <p>{notice}</p>
            </div>
          )}
          {error && <AlertError title='Không thể xác thực' errors={[error]} />}
          <verifyForm.Subscribe
            selector={(state) => ({
              verifying: state.isSubmitting,
              email: state.values.email,
            })}
          >
            {({ verifying, email }) => {
              const normalizedCurrent = normalizeEmail(email);
              const waitingCooldown = normalizedCurrent === cooldownEmail && secondsLeft > 0;
              return (
                <div className='auth-action-stack'>
                  <Button
                    type='submit'
                    className='auth-submit-btn'
                    disabled={verifying || resending}
                  >
                    {verifying ? (
                      <>
                        <Loader2 className='size-4 animate-spin' aria-hidden='true' />
                        Đang xác thực…
                      </>
                    ) : (
                      <>
                        <ShieldCheck className='size-4' aria-hidden='true' />
                        Xác thực email
                      </>
                    )}
                  </Button>
                  <Button
                    type='button'
                    variant='secondary'
                    className='auth-submit-btn'
                    disabled={verifying || resending || waitingCooldown || !normalizedCurrent}
                    onClick={() => void resend()}
                  >
                    {resending ? (
                      <>
                        <Loader2 className='size-4 animate-spin' aria-hidden='true' />
                        Đang gửi mã…
                      </>
                    ) : (
                      <>
                        <RotateCcw className='size-4' aria-hidden='true' />
                        {waitingCooldown ? `Gửi lại mã sau ${secondsLeft}s` : 'Gửi lại mã OTP'}
                      </>
                    )}
                  </Button>
                </div>
              );
            }}
          </verifyForm.Subscribe>
        </form>
      )}
    </AuthFrame>
  );
}
