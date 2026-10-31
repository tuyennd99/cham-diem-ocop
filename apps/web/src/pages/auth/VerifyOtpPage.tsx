import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '../../api/auth';
import { ApiError, messageOf } from '../../lib/api-error';
import { homeFor, setSession } from '../../lib/auth';
import { normalizeEmail } from '../../lib/utils';
import { AuthFrame } from './AuthFrame';
import {
  clearPendingEmail,
  verifyPendingRegistration,
  writePendingEmail,
  type VerificationState,
} from './pending-email';

export function VerifyOtpPage() {
  const state = useLoaderData({ from: '/_auth/verify-otp' });
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  return (
    <AuthFrame
      eyebrow='TÀI KHOẢN OCOP'
      title={
        state.kind === 'pending' && state.pending.mode === 'google-link'
          ? 'Liên kết tài khoản Google'
          : 'Xác thực email'
      }
      intro='Nhập mã OTP gồm 6 chữ số được gửi tới hộp thư. Mã chỉ có hiệu lực trong thời gian giới hạn.'
      backTo='/login'
      backLabel='Quay lại trang đăng nhập'
    >
      {state.kind === 'error' ? (
        <div className='account-form'>
          <AlertError title='Không thể mở phiên xác thực' errors={[state.message]} />
          {state.retryable && (
            <Button
              type='button'
              loading={retrying}
              disabled={retrying}
              onClick={() => {
                setRetrying(true);
                void router.invalidate().finally(() => setRetrying(false));
              }}
            >
              Kiểm tra lại phiên xác thực
            </Button>
          )}
          <Link className='text-link' to='/register' onClick={clearPendingEmail}>
            Đăng ký lại
          </Link>
          <Link
            className='text-link'
            to='/verify-otp'
            search={{ legacy: true }}
            onClick={clearPendingEmail}
          >
            Xác thực tài khoản đã đăng ký trước đây bằng email
          </Link>
        </div>
      ) : (
        <VerificationForm
          key={state.kind === 'pending' ? state.pending.registrationToken : 'legacy'}
          initial={state}
        />
      )}
    </AuthFrame>
  );
}

function VerificationForm({ initial }: { initial: Exclude<VerificationState, { kind: 'error' }> }) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(initial.kind === 'pending' ? initial.pending : null);
  const [now, setNow] = useState(Date.now);
  const [legacyResendAt, setLegacyResendAt] = useState(0);
  const [cooldownEmail, setCooldownEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const expired = pending !== null && Date.parse(pending.expiresAt) <= now;
  const otpExpired = pending !== null && Date.parse(pending.otpExpiresAt) <= now;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const verifyForm = useForm({
    defaultValues: {
      email: initial.kind === 'pending' ? initial.pending.email : initial.email,
      code: '',
    },
    onSubmit: async ({ value }) => {
      setError('');
      setNotice('');
      setEmailError('');
      setCodeError('');
      const email = normalizeEmail(value.email);
      if (!pending && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailError('Nhập địa chỉ email hợp lệ dùng khi đăng ký.');
        return;
      }
      if (!/^\d{6}$/.test(value.code)) {
        setCodeError('Mã xác thực gồm đúng 6 chữ số.');
        return;
      }
      if (expired || otpExpired) {
        setCodeError(
          expired
            ? 'Phiên xác thực đã hết hạn. Vui lòng đăng ký lại.'
            : 'Mã đã hết hạn. Vui lòng gửi mã mới.',
        );
        return;
      }
      try {
        const data = await verifyPendingRegistration(pending, email, value.code);
        if (data) {
          setSession({ accessToken: data.accessToken, user: data.user });
          await navigate({ to: homeFor(data.user.role, data.user.staffPermissions) });
        } else {
          verifyForm.setFieldValue('code', '');
          setSuccess(true);
        }
      } catch (cause) {
        if (pending && cause instanceof ApiError && cause.status === 410) {
          clearPendingEmail();
          await navigate({
            to: pending.mode === 'google-link' ? '/login' : '/register',
            replace: true,
          });
        } else if (cause instanceof ApiError && cause.status === 409)
          setError('Tài khoản hoặc email này đã được dùng. Vui lòng đăng nhập.');
        else if (cause instanceof ApiError && cause.status === 401)
          setCodeError(
            'Mã không đúng, đã hết hạn hoặc phiên không còn hiệu lực. Kiểm tra email hoặc gửi mã mới.',
          );
        else setError(messageOf(cause));
      }
    },
  });

  async function resend() {
    const email = normalizeEmail(verifyForm.state.values.email);
    if (resending || verifyForm.state.isSubmitting || expired) return;
    setError('');
    setNotice('');
    setEmailError('');
    if (!pending && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Nhập địa chỉ email hợp lệ để nhận mã xác thực.');
      return;
    }
    const availableAt = pending
      ? Date.parse(pending.resendAvailableAt)
      : email === cooldownEmail
        ? legacyResendAt
        : 0;
    if (availableAt > Date.now()) return;
    setResending(true);
    try {
      if (pending) {
        const input = { registrationToken: pending.registrationToken };
        const { data } = await (pending.mode === 'google-link'
          ? authApi.googleLinkResend(input)
          : authApi.resendOtp(input));
        const next = {
          ...pending,
          otpExpiresAt: data.otpExpiresAt,
          resendAvailableAt: data.resendAvailableAt,
        };
        writePendingEmail(next);
        setPending(next);
        setNotice('Mã OTP mới đã được gửi tới hộp thư.');
      } else {
        await authApi.legacyResendOtp({ email });
        setCooldownEmail(email);
        setLegacyResendAt(Date.now() + 60_000);
        setNotice('Nếu có tài khoản cũ đang chờ xác thực, mã OTP đã được gửi tới hộp thư.');
      }
      verifyForm.setFieldValue('code', '');
      setCodeError('');
      setNow(Date.now());
    } catch (cause) {
      if (pending && cause instanceof ApiError && cause.status === 410) {
        clearPendingEmail();
        await navigate({
          to: pending.mode === 'google-link' ? '/login' : '/register',
          replace: true,
        });
        return;
      }
      setError(
        cause instanceof ApiError && cause.status === 429
          ? 'Vui lòng chờ trước khi gửi lại mã.'
          : messageOf(cause),
      );
    } finally {
      setResending(false);
    }
  }

  if (success)
    return (
      <div className='auth-success' role='status' aria-live='polite'>
        <div className='auth-status-banner'>
          <CheckCircle2 className='size-5 shrink-0' aria-hidden='true' />
          <div>
            <strong>Email đã được xác thực thành công</strong>
            <p>Tiếp tục đăng nhập để tạo và quản lý hồ sơ OCOP.</p>
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
    );

  return (
    <form
      className='account-form'
      onSubmit={(event) => {
        event.preventDefault();
        void verifyForm.handleSubmit();
      }}
    >
      {!pending && (
        <p className='form-note' role='status'>
          Khôi phục xác thực cho tài khoản đã đăng ký trước đây. Đăng ký mới cần phiên xác thực nhận
          được sau khi gửi biểu mẫu đăng ký.
        </p>
      )}
      {expired && (
        <AlertError
          title='Phiên xác thực đã hết hạn'
          errors={['Vui lòng đăng ký lại để nhận phiên và mã mới.']}
        />
      )}
      <verifyForm.Field name='email'>
        {(field) => (
          <FormField
            label='Email nhận mã'
            htmlFor='verify-otp-email'
            hint={
              pending
                ? 'Email của phiên xác thực. Đăng ký lại nếu cần dùng email khác.'
                : 'Nhập email của tài khoản đã đăng ký trước đây.'
            }
          >
            <Input
              id='verify-otp-email'
              name={field.name}
              type='email'
              autoComplete='email'
              value={field.state.value}
              readOnly={Boolean(pending)}
              onBlur={field.handleBlur}
              onChange={(event) => {
                field.handleChange(event.target.value);
                setEmailError('');
              }}
              aria-invalid={Boolean(emailError)}
              aria-describedby='otp-email-error verify-otp-email-hint'
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
            htmlFor='verify-otp-code'
            hint='Nhập hoặc dán mã 6 chữ số từ email. Kiểm tra mục Thư rác nếu chưa thấy.'
          >
            <Input
              id='verify-otp-code'
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
                setCodeError('');
              }}
              aria-invalid={Boolean(codeError)}
              aria-describedby='otp-code-error verify-otp-code-hint'
              required
            />
          </FormField>
        )}
      </verifyForm.Field>
      <InputError id='otp-code-error' role='alert' message={codeError} />
      {otpExpired && !expired && <p role='status'>Mã đã hết hạn. Vui lòng gửi mã OTP mới.</p>}
      {notice && (
        <p className='form-note' role='status'>
          {notice}
        </p>
      )}
      {error && <AlertError title='Không thể xác thực' errors={[error]} />}
      <verifyForm.Subscribe
        selector={(state) => ({ verifying: state.isSubmitting, email: state.values.email })}
      >
        {({ verifying, email }) => {
          const availableAt = pending
            ? Date.parse(pending.resendAvailableAt)
            : normalizeEmail(email) === cooldownEmail
              ? legacyResendAt
              : 0;
          const secondsLeft = Math.max(0, Math.ceil((availableAt - now) / 1000));
          return (
            <div className='auth-action-stack'>
              <Button
                type='submit'
                className='auth-submit-btn'
                loading={verifying}
                disabled={verifying || resending || expired || otpExpired}
              >
                <ShieldCheck className='size-4' aria-hidden='true' />
                {verifying
                  ? 'Đang xác thực…'
                  : pending?.mode === 'google-link'
                    ? 'Xác thực và liên kết Google'
                    : 'Xác thực email'}
              </Button>
              <Button
                type='button'
                variant='secondary'
                className='auth-submit-btn'
                loading={resending}
                disabled={verifying || resending || secondsLeft > 0 || expired || !email.trim()}
                onClick={() => void resend()}
              >
                {resending
                  ? 'Đang gửi mã…'
                  : secondsLeft > 0
                    ? `Gửi lại mã sau ${secondsLeft}s`
                    : 'Gửi lại mã OTP'}
              </Button>
              {pending && (
                <Link
                  className='text-link'
                  to='/verify-otp'
                  search={{ legacy: true }}
                  onClick={clearPendingEmail}
                >
                  Xác thực tài khoản đã đăng ký trước đây bằng email
                </Link>
              )}
              <Link
                className='text-link'
                to={pending?.mode === 'google-link' ? '/login' : '/register'}
                onClick={clearPendingEmail}
              >
                {pending?.mode === 'google-link'
                  ? 'Đăng nhập Google lại'
                  : 'Đăng ký lại với email khác'}
              </Link>
            </div>
          );
        }}
      </verifyForm.Subscribe>
    </form>
  );
}
