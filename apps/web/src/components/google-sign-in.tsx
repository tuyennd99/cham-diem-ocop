import { useEffect, useRef, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { authApi } from '../api/auth';
import { ApiError, messageOf } from '../lib/api-error';
import { homeFor, setSession } from '../lib/auth';
import { optionalText } from '../lib/utils';
import { clearPendingEmail, writePendingEmail } from '../pages/auth/pending-email';
import type { GoogleInput, GoogleProfileResult, GoogleResult } from '../types/auth';
import AlertError from './alert-error';
import { FormField } from './form-field';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface GoogleIdentity {
  initialize(config: {
    client_id: string;
    nonce: string;
    callback: (response: { credential?: string }) => void;
    auto_select: boolean;
    ux_mode: 'popup';
  }): void;
  renderButton(
    element: HTMLElement,
    config: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      text: 'signin_with' | 'signup_with';
      locale: string;
      click_listener: () => void;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let scriptPromise: Promise<GoogleIdentity> | undefined;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (!scriptPromise) {
    scriptPromise = new Promise<GoogleIdentity>((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(failed, 15_000);
      function failed() {
        clearTimeout(timer);
        script.remove();
        reject(new Error('Không thể tải đăng nhập Google. Kiểm tra kết nối và thử lại.'));
      }
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        clearTimeout(timer);
        if (window.google?.accounts.id) resolve(window.google.accounts.id);
        else failed();
      };
      script.onerror = failed;
      document.head.appendChild(script);
    }).catch((cause: unknown) => {
      scriptPromise = undefined;
      throw cause;
    });
  }
  return scriptPromise;
}

export function GoogleSignIn({ intent }: { intent: GoogleInput['intent'] }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  return clientId ? <ConfiguredGoogleSignIn clientId={clientId} intent={intent} /> : null;
}

function ConfiguredGoogleSignIn({
  clientId,
  intent,
}: {
  clientId: string;
  intent: GoogleInput['intent'];
}) {
  const navigate = useNavigate();
  const container = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'waiting' | 'posting' | 'error'>(
    'loading',
  );
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<GoogleProfileResult | null>(null);

  async function accept(result: GoogleResult) {
    if (result.kind === 'session') {
      clearPendingEmail();
      setSession({ accessToken: result.accessToken, user: result.user });
      await navigate({ to: homeFor(result.user.role, result.user.staffPermissions) });
    } else if (result.kind === 'profile') {
      setProfile(result);
      profileForm.setFieldValue('fullName', result.suggestedName ?? '');
    } else {
      writePendingEmail({ ...result, mode: 'google-link' });
      await navigate({ to: '/verify-otp', search: {} });
    }
  }

  const profileForm = useForm({
    defaultValues: { fullName: '', phone: '' },
    onSubmit: async ({ value }) => {
      if (!profile) return;
      setError('');
      if (!value.fullName.trim()) {
        setError('Nhập tên người đăng ký hoặc đơn vị.');
        return;
      }
      try {
        const { data } = await authApi.googleRegister({
          registrationToken: profile.registrationToken,
          fullName: value.fullName.trim(),
          phone: optionalText(value.phone),
        });
        writePendingEmail({ ...data, mode: 'register' });
        await navigate({ to: '/verify-otp', search: {} });
      } catch (cause) {
        setError(
          cause instanceof ApiError && cause.status === 409
            ? 'Tài khoản Google hoặc email này đã được dùng. Vui lòng đăng nhập.'
            : messageOf(cause),
        );
      }
    },
  });

  useEffect(() => {
    let active = true;
    let used = false;
    setPhase('loading');
    async function prepare() {
      try {
        const google = await loadGoogleIdentity();
        if (!active) return;
        const { data: challenge } = await authApi.googleChallenge();
        if (!active || !container.current) return;
        google.initialize({
          client_id: clientId,
          nonce: challenge.nonce,
          auto_select: false,
          ux_mode: 'popup',
          callback: (response) => {
            if (!active || used) return;
            if (!response.credential) {
              setError('Đăng nhập Google đã bị hủy hoặc không hoàn tất. Vui lòng thử lại.');
              setPhase('error');
              return;
            }
            used = true;
            setPhase('posting');
            setError('');
            void authApi
              .google({
                challengeToken: challenge.challengeToken,
                credential: response.credential,
                intent,
              })
              .then(async ({ data }) => {
                if (active) await accept(data);
              })
              .catch((cause: unknown) => {
                if (!active) return;
                setError(
                  cause instanceof ApiError
                    ? cause.status === 409
                      ? 'Tài khoản Google này đã được dùng. Vui lòng đăng nhập.'
                      : cause.message
                    : 'Chưa thể đăng nhập Google. Kiểm tra kết nối và thử lại.',
                );
                setPhase('error');
              });
          },
        });
        container.current.replaceChildren();
        google.renderButton(container.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          locale: 'vi',
          text: intent === 'login' ? 'signin_with' : 'signup_with',
          click_listener: () => {
            if (active && !used) {
              setError('');
              setPhase('waiting');
            }
          },
        });
        setPhase('ready');
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof ApiError
            ? cause.message
            : 'Không thể tải đăng nhập Google. Kiểm tra kết nối và thử lại.',
        );
        setPhase('error');
      }
    }
    void prepare();
    return () => {
      active = false;
    };
  }, [clientId, intent, attempt]);

  function restart() {
    setProfile(null);
    setError(
      phase === 'waiting'
        ? 'Đăng nhập Google đã bị hủy hoặc chưa hoàn tất. Bạn có thể thử lại.'
        : '',
    );
    setAttempt((value) => value + 1);
  }

  return (
    <section className='account-form' aria-label='Đăng nhập bằng Google'>
      {profile ? (
        <form
          className='account-form'
          onSubmit={(event) => {
            event.preventDefault();
            void profileForm.handleSubmit();
          }}
        >
          <p className='form-note'>Xác nhận tên người đăng ký hoặc đơn vị trước khi nhận mã OTP.</p>
          <FormField label='Email Google' htmlFor='google-profile-email'>
            <Input id='google-profile-email' type='email' value={profile.email} readOnly />
          </FormField>
          <profileForm.Field name='fullName'>
            {(field) => (
              <FormField label='Tên người đăng ký hoặc đơn vị' htmlFor='google-profile-name'>
                <Input
                  id='google-profile-name'
                  autoComplete='organization'
                  maxLength={255}
                  required
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </FormField>
            )}
          </profileForm.Field>
          <profileForm.Field name='phone'>
            {(field) => (
              <FormField
                label='Số điện thoại'
                optional='(không bắt buộc)'
                htmlFor='google-profile-phone'
              >
                <Input
                  id='google-profile-phone'
                  type='tel'
                  autoComplete='tel'
                  maxLength={30}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </FormField>
            )}
          </profileForm.Field>
          <profileForm.Subscribe selector={(state) => state.isSubmitting}>
            {(busy) => (
              <>
                <Button type='submit' loading={busy} disabled={busy}>
                  Gửi mã xác thực email
                </Button>
                <Button type='button' variant='secondary' disabled={busy} onClick={restart}>
                  Chọn lại tài khoản Google
                </Button>
              </>
            )}
          </profileForm.Subscribe>
        </form>
      ) : (
        <>
          <div
            ref={container}
            hidden={phase === 'loading' || phase === 'error'}
            inert={phase === 'posting' || phase === 'waiting'}
          />
          {phase === 'loading' && <p role='status'>Đang chuẩn bị đăng nhập Google…</p>}
          {phase === 'posting' && <p role='status'>Đang xác minh tài khoản Google…</p>}
          {phase === 'waiting' && (
            <p role='status'>
              Hoàn tất trong cửa sổ Google. Nếu đã đóng cửa sổ, chọn hủy và thử lại.
            </p>
          )}
          {(phase === 'waiting' || phase === 'error') && (
            <Button type='button' variant='secondary' onClick={restart}>
              {phase === 'waiting' ? 'Hủy và thử lại' : 'Thử lại đăng nhập Google'}
            </Button>
          )}
        </>
      )}
      {error && <AlertError title='Không thể tiếp tục với Google' errors={[error]} />}
    </section>
  );
}
