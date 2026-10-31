import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root, configFile: false, envDir: false, appType: 'custom',
  plugins: [{
    name: 'auth-ui-check',
    enforce: 'pre',
    resolveId: (id) => id === 'virtual:auth-ui-check' ? '\0auth-ui-check' : undefined,
    load: (id) => id === '\0auth-ui-check' ? `
      export const useState = (...args) => globalThis.authUiCheck.useState(...args);
      export const useEffect = (...args) => globalThis.authUiCheck.useEffect(...args);
      export const useRef = (...args) => globalThis.authUiCheck.useRef(...args);
      export const useForm = (...args) => globalThis.authUiCheck.useForm(...args);
      export const useNavigate = () => globalThis.authUiCheck.navigate;
      export const useLoaderData = () => globalThis.authUiCheck.loaderData;
      export const useRouter = () => ({ invalidate: async () => {} });
    ` : undefined,
    transform(code, id) {
      if (!/\/(google-sign-in|RegisterPage|VerifyOtpPage)\.tsx$/.test(id.replaceAll('\\', '/'))) return;
      return code
        .replace(/import \{ (useEffect, useRef, useState|useEffect, useState|useState) \} from 'react';/, (value, names) => `import { ${names} } from 'virtual:auth-ui-check';`)
        .replace("import { useForm } from '@tanstack/react-form';", "import { useForm } from 'virtual:auth-ui-check';")
        .replace("import { useNavigate } from '@tanstack/react-router';", "import { useNavigate } from 'virtual:auth-ui-check';")
        .replace("import { Link, useNavigate } from '@tanstack/react-router';", "import { Link } from '@tanstack/react-router'; import { useNavigate } from 'virtual:auth-ui-check';")
        .replace("import { Link, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router';", "import { Link } from '@tanstack/react-router'; import { useLoaderData, useNavigate, useRouter } from 'virtual:auth-ui-check';")
        .replace('import.meta.env.VITE_GOOGLE_CLIENT_ID', 'globalThis.authUiCheck?.clientId');
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  ssr: { optimizeDeps: { include: ['react', 'react-dom', 'zustand', '@tanstack/react-query', '@tanstack/react-form', 'axios', 'lodash'] } },
  server: { middlewareMode: true, watch: null, hmr: false },
});
const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let restoreAxiosAdapter = () => {};
const storage = new Map();
const redirects = [];
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  sessionStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  },
  location: { replace: (url) => redirects.push(url) },
} });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: window.localStorage });
try {
  const { validateProductFile, PRODUCT_FILE_ACCEPT } = await server.ssrLoadModule('/src/lib/attachments.ts');
  assert.equal(typeof validateProductFile, 'function');
  for (const [extension, type] of [
    ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'], ['webp', 'image/webp'], ['pdf', 'application/pdf'],
  ]) {
    assert.doesNotThrow(() => validateProductFile({ name: `a.${extension}`, type, size: 10 * 1024 * 1024 }));
  }
  assert.doesNotThrow(() => validateProductFile({ name: 'a.PDF', type: 'application/pdf', size: 1 }));
  for (const file of [
    { name: 'a.svg', type: 'image/svg+xml', size: 1 },
    { name: 'a.png', type: 'application/pdf', size: 1 },
    { name: 'a.pdf', type: 'application/pdf', size: 0 },
    { name: 'a.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 },
  ]) assert.throws(() => validateProductFile(file));
  assert.ok(!PRODUCT_FILE_ACCEPT.includes('image/*'));
  const { formatFormEntries } = await server.ssrLoadModule('/src/lib/utils.ts');
  assert.equal(typeof formatFormEntries, 'function');
  assert.deepEqual(formatFormEntries({
    entityName: 'HTX Chè',
    registrationType: 'FIRST',
    sampleQuantity: 2,
    declarationAccepted: true,
    phone: '',
  }), [
    { key: 'entityName', label: 'Tên đơn vị sản xuất', value: 'HTX Chè' },
    { key: 'registrationType', label: 'Loại đăng ký', value: 'Lần đầu' },
    { key: 'sampleQuantity', label: 'Số lượng mẫu', value: '2' },
    { key: 'declarationAccepted', label: 'Cam kết hồ sơ', value: 'Có' },
    { key: 'phone', label: 'Điện thoại', value: 'Chưa cung cấp' },
  ]);
  const authConstants = await server.ssrLoadModule('/src/constants/auth.ts');
  const { DEFAULT_PAGE_SIZE } = await server.ssrLoadModule('/src/constants/consts.ts');
  assert.equal(authConstants.SESSION_STORAGE_KEY, 'ocop-session');
  assert.equal(authConstants.PENDING_EMAIL_STORAGE_KEY, 'ocop.pendingEmail');
  assert.equal(DEFAULT_PAGE_SIZE, 10);
  assert.deepEqual(Object.keys(authConstants).sort(), [
    'AUTH_ACCESS_TOKEN_STORAGE_KEY', 'AUTH_REFRESH_TOKEN_STORAGE_KEY',
    'AUTH_TOKEN_STORAGE_KEY', 'AUTH_USER_STORAGE_KEY',
    'PENDING_EMAIL_STORAGE_KEY', 'SESSION_STORAGE_KEY',
  ]);
  console.log('PASS file contract');

  {
    const { ApiError, messageOf, errorText } = await server.ssrLoadModule('/src/lib/api-error.ts');
    assert.equal(messageOf(new ApiError('failure', 400)), 'failure');
    assert.equal(errorText(null), '');
    const { getSession, setSession, validatePasswordBytes } = await server.ssrLoadModule('/src/lib/auth.ts');
    const { queryClient } = await server.ssrLoadModule('/src/lib/query-client.ts');
    const { queryKeys } = await server.ssrLoadModule('/src/constants/query-key.ts');
    const { API } = await server.ssrLoadModule('/src/constants/api.ts');
    assert.equal(API.my.attachment('a/b', 'c'), '/my/products/a%2Fb/attachments/c');
    assert.equal(typeof validatePasswordBytes, 'function');
    assert.doesNotThrow(() => validatePasswordBytes('a'.repeat(72)));
    assert.doesNotThrow(() => validatePasswordBytes('Đ'.repeat(36)));
    assert.throws(() => validatePasswordBytes('Đ'.repeat(37)), /72 byte UTF-8/);
    assert.doesNotThrow(() => validatePasswordBytes('ệ'.repeat(24)));
    assert.throws(() => validatePasswordBytes('ệ'.repeat(25)), /72 byte UTF-8/);
    const session = { accessToken: 'test-token', user: {
      id: 'user-1', email: 'a@example.invalid', fullName: 'A', phone: null,
      role: 'REGISTRANT', verified: true,
    } };
    setSession(session);
    queryClient.setQueryData(queryKeys.myProducts.list, [{ id: 'cached' }]);
    assert.equal(queryClient.getQueryData(queryKeys.myProducts.list)?.length, 1);
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
    const form = new FormData(); form.append('file', new Blob(['x']), 'x.pdf');
    setSession(session);
    queryClient.setQueryData(queryKeys.myProducts.list, [{ id: 'cached' }]);
    redirects.length = 0;
    const { default: baseRequest, requestJson, requestBlob } =
      await server.ssrLoadModule('/src/api/base-request.ts');
    const { AxiosError } = await import('axios');
    const originalAdapter = baseRequest.defaults.adapter;
    restoreAxiosAdapter = () => { baseRequest.defaults.adapter = originalAdapter; };
    function reply(status, data, inspect = () => {}) {
      baseRequest.defaults.adapter = async (config) => {
        inspect(config);
        const response = { status, statusText: String(status), data, headers: {}, config };
        if (status >= 400) throw new AxiosError('HTTP failure', undefined, config, null, response);
        return response;
      };
    }
    {
      const { authApi } = await server.ssrLoadModule('/src/api/auth.ts');
      setSession(session);
      redirects.length = 0;
      reply(200, { data: { challengeToken: 'challenge', nonce: 'nonce' } }, (config) => {
        assert.equal(config.url, '/auth/google/challenge');
        assert.equal(config.method, 'post');
        assert.equal(config.headers.get('Authorization'), undefined);
      });
      assert.equal((await authApi.googleChallenge()).data.nonce, 'nonce');
      const pending = {
        registrationToken: 'opaque-registration', email: 'owner@example.invalid',
        expiresAt: '2099-01-01T00:15:00.000Z', otpExpiresAt: '2099-01-01T00:05:00.000Z',
        resendAvailableAt: '2099-01-01T00:01:00.000Z', mode: 'register',
      };
      const sessionResult = { kind: 'session', accessToken: 'google-session', user: session.user, expiresIn: 3600 };
      const { mode, ...registrationResult } = pending;
      const { registrationToken, ...statusResult } = pending;
      for (const [method, url, input, output] of [
        ['google', '/auth/google', { challengeToken: 'challenge', credential: 'private-google-credential', intent: 'login' }, sessionResult],
        ['google', '/auth/google', { challengeToken: 'challenge', credential: 'private-google-credential', intent: 'register' }, { kind: 'profile', registrationToken: 'profile', email: pending.email, suggestedName: 'Owner' }],
        ['google', '/auth/google', { challengeToken: 'challenge', credential: 'private-google-credential', intent: 'login' }, { ...registrationResult, kind: 'link_otp' }],
        ['register', '/auth/register', { email: pending.email, password: 'private-password', fullName: 'Owner' }, registrationResult],
        ['googleRegister', '/auth/google/register', { registrationToken: 'profile', fullName: 'Confirmed owner', phone: '0123456789' }, registrationResult],
        ['registrationStatus', '/auth/registration-status', { registrationToken: pending.registrationToken }, statusResult],
        ['verifyOtp', '/auth/verify-otp', { registrationToken: 'test', code: '123456' }, { message: 'Registration completed' }],
        ['resendOtp', '/auth/resend-otp', { registrationToken: 'test' }, { message: 'Verification code sent', otpExpiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt }],
        ['googleLinkVerify', '/auth/google/link/verify', { registrationToken: 'test', code: '123456' }, sessionResult],
        ['googleLinkResend', '/auth/google/link/resend', { registrationToken: 'test' }, { message: 'Verification code sent', otpExpiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt }],
        ['legacyVerifyOtp', '/auth/legacy-registration/verify', { email: pending.email, code: '123456' }, { message: 'Account verified' }],
        ['legacyResendOtp', '/auth/legacy-registration/resend', { email: pending.email }, { message: 'If an unverified account exists, a verification code has been sent' }],
        ['resetPassword', '/auth/reset-password', { email: pending.email, code: '123456', newPassword: 'private-password' }, { message: 'Password reset' }],
      ]) {
        reply(200, { data: output }, (config) => {
          assert.equal(config.url, url);
          assert.equal(config.method, 'post');
          assert.deepEqual(JSON.parse(config.data), input);
          assert.equal(config.headers.get('Authorization'), undefined);
          assert.match(config.headers.getContentType(), /application\/json/);
        });
        assert.deepEqual((await authApi[method](input)).data, output);
      }
      reply(401, { message: 'Invalid or expired registration' });
      await assert.rejects(authApi.googleLinkVerify({ registrationToken: 'test', code: '123456' }), { status: 401 });
      assert.equal(getSession().accessToken, session.accessToken);
      assert.deepEqual(redirects, []);
      const { readPendingEmail, writePendingEmail, clearPendingEmail, loadPendingRegistration, verifyPendingRegistration } =
        await server.ssrLoadModule('/src/pages/auth/pending-email.ts');
      clearPendingEmail();
      assert.deepEqual(await loadPendingRegistration(), { kind: 'legacy', email: '' });
      writePendingEmail({ ...pending, password: 'private-password', credential: 'private-google-credential', code: '123456' });
      const stored = storage.get('ocop.pendingEmail');
      assert.deepEqual(JSON.parse(stored), pending);
      assert.ok(!stored.includes('private-password') && !stored.includes('private-google-credential') && !stored.includes('123456'));
      assert.deepEqual(readPendingEmail(), pending);
      const status = { ...statusResult, mode: 'google-link', email: 'server-owned@example.invalid' };
      reply(200, { data: status }, (config) => {
        assert.equal(config.url, '/auth/registration-status');
        assert.deepEqual(JSON.parse(config.data), { registrationToken: 'opaque-registration' });
      });
      assert.deepEqual(await loadPendingRegistration(), { kind: 'pending', pending: { ...status, registrationToken } });
      reply(200, { data: { ...status, expiresAt: '2000-01-01T00:00:00.000Z' } });
      assert.equal((await loadPendingRegistration()).kind, 'error');
      reply(401, { message: 'Invalid or expired registration' });
      assert.equal((await loadPendingRegistration()).kind, 'error');
      assert.equal((await loadPendingRegistration()).retryable, false);
      baseRequest.defaults.adapter = async () => { throw new Error('Network Error'); };
      assert.equal((await loadPendingRegistration()).retryable, true);
      assert.deepEqual(await loadPendingRegistration(true), { kind: 'legacy', email: status.email });
      storage.set('ocop.pendingEmail', JSON.stringify({ registrationToken: 'broken' }));
      assert.equal(readPendingEmail(), null);
      assert.equal((await loadPendingRegistration()).kind, 'error');
      storage.set('ocop.pendingEmail', 'legacy@example.invalid');
      assert.deepEqual(await loadPendingRegistration(), { kind: 'legacy', email: 'legacy@example.invalid' });
      const { Route } = await server.ssrLoadModule('/src/routes/_auth.verify-otp.tsx');
      assert.deepEqual(Route.options.validateSearch({ legacy: 'true', registrationToken: 'never-a-search-field' }), { legacy: true });
      assert.deepEqual(await Route.options.loader({ deps: { legacy: false } }), { kind: 'legacy', email: 'legacy@example.invalid' });
      for (const [current, url, input, output] of [
        [pending, '/auth/verify-otp', { registrationToken: pending.registrationToken, code: '123456' }, { message: 'Registration completed' }],
        [{ ...pending, mode: 'google-link' }, '/auth/google/link/verify', { registrationToken: pending.registrationToken, code: '123456' }, sessionResult],
        [null, '/auth/legacy-registration/verify', { email: 'legacy@example.invalid', code: '123456' }, { message: 'Account verified' }],
      ]) {
        writePendingEmail(pending);
        reply(401, { message: 'Invalid verification code' });
        await assert.rejects(verifyPendingRegistration(current, 'legacy@example.invalid', '123456'), { status: 401 });
        assert.ok(readPendingEmail());
        reply(200, { data: output }, (config) => {
          assert.equal(config.url, url);
          assert.deepEqual(JSON.parse(config.data), input);
        });
        const result = await verifyPendingRegistration(current, 'legacy@example.invalid', '123456');
        assert.deepEqual(result, current?.mode === 'google-link' ? sessionResult : null);
        assert.equal(readPendingEmail(), null);
        assert.equal(storage.has('ocop.pendingEmail'), false);
      }
      const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
      const { loadGoogleIdentity, GoogleSignIn } = await server.ssrLoadModule('/src/components/google-sign-in.tsx');
      const { renderToString } = await import('react-dom/server');
      const { createElement } = await import('react');
      assert.equal(renderToString(createElement(GoogleSignIn, { intent: 'login' })), '');
      let scripts = 0;
      Object.defineProperty(globalThis, 'document', { configurable: true, value: {
        createElement: () => ({ remove() {} }),
        head: { appendChild: (script) => {
          scripts += 1;
          assert.equal(script.src, 'https://accounts.google.com/gsi/client');
          window.google = { accounts: { id: { initialize() {}, renderButton() {} } } };
          queueMicrotask(() => script.onload());
        } },
      } });
      try {
        const [first, second] = await Promise.all([loadGoogleIdentity(), loadGoogleIdentity()]);
        assert.equal(first, window.google.accounts.id);
        assert.equal(second, first);
        assert.equal(scripts, 1);

        // Run the actual auth component handlers with local hooks/GIS, without a DOM library.
        const states = [];
        const effects = [];
        const forms = [];
        const navigations = [];
        let cursor = 0;
        let effectCursor = 0;
        let formCursor = 0;
        let rendered;
        const flush = () => new Promise((resolve) => setImmediate(resolve));
        const container = { replaceChildren() {} };
        globalThis.authUiCheck = {
          clientId: 'local-ui-client',
          useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
          },
          useRef: () => ({ current: container }),
          useEffect(callback, deps) {
            const index = effectCursor++;
            if (!effects[index] || deps.some((value, i) => value !== effects[index].deps[i])) {
              effects[index]?.cleanup?.();
              effects[index] = { deps, cleanup: callback() };
            }
          },
          useForm(options) {
            const form = forms[formCursor++] ?? options;
            if (!forms.includes(form)) forms.push(form);
            form.onSubmit = options.onSubmit;
            return { state: { values: form.defaultValues, isSubmitting: false }, Field() {}, Subscribe() {}, handleSubmit() {}, setFieldValue(name, value) { form.defaultValues[name] = value; } };
          },
          navigate: async (to) => { navigations.push(to); },
        };
        const reset = () => {
          for (const effect of effects) effect.cleanup?.();
          effects.length = states.length = forms.length = navigations.length = 0;
        };
        const render = (Component, props = {}) => {
          cursor = effectCursor = formCursor = 0;
          rendered = Component(props);
          return rendered;
        };
        const elements = (node) => !node || typeof node !== 'object' ? []
          : [node, ...[node.props?.children].flat(Infinity).flatMap(elements)];
        const button = (label) => elements(rendered).find((node) => node.props?.children === label);
        const { RegisterPage } = await server.ssrLoadModule('/src/pages/auth/RegisterPage.tsx');
        reset();
        writePendingEmail(pending);
        render(RegisterPage);
        reply(500, { message: 'Registration failed' }, () => assert.equal(readPendingEmail(), null));
        await forms.at(-1).onSubmit({ value: { email: 'second@example.invalid', fullName: 'Second', phone: '', password: 'ValidPassword1!' } });
        assert.equal(readPendingEmail(), null, 'failed registration B must not reopen session A');
        assert.deepEqual(navigations, []);
        reply(200, { data: registrationResult });
        await forms.at(-1).onSubmit({ value: { email: pending.email, fullName: 'Second', phone: '', password: 'ValidPassword1!' } });
        assert.deepEqual(readPendingEmail(), pending);
        assert.equal(navigations.at(-1).to, '/verify-otp');
        for (const mode of ['register', 'google-link']) {
          writePendingEmail({ ...pending, mode });
          reply(410, { message: 'Verification session locked' });
          await assert.rejects(Route.options.loader({ deps: { legacy: false } }), (error) =>
            error.options?.to === (mode === 'google-link' ? '/login' : '/register'));
          assert.equal(readPendingEmail(), null);
        }
        const { VerifyOtpPage } = await server.ssrLoadModule('/src/pages/auth/VerifyOtpPage.tsx');
        window.setInterval = () => 1;
        window.clearInterval = () => {};
        for (const mode of ['register', 'google-link']) {
          for (const action of ['verify', 'resend', 'abandon']) {
            reset();
            const live = { ...pending, mode, resendAvailableAt: '2000-01-01T00:00:00.000Z' };
            writePendingEmail(live);
            globalThis.authUiCheck.loaderData = { kind: 'pending', pending: live };
            const page = render(VerifyOtpPage);
            const form = elements(page).find((node) => node.props?.initial);
            reset();
            render(form.type, form.props);
            reply(410, { message: 'Verification session locked' });
            if (action === 'verify') {
              await forms.at(-1).onSubmit({ value: { email: live.email, code: '123456' } });
            } else {
              const subscribe = elements(rendered).find((node) => node.type?.name === 'Subscribe');
              rendered = subscribe.props.children({ verifying: false, email: live.email });
              if (action === 'resend') {
                elements(rendered).find((node) => node.props?.variant === 'secondary').props.onClick();
                await flush();
              } else {
                const link = elements(rendered).find((node) => node.props?.to === (mode === 'google-link' ? '/login' : '/register'));
                link.props.onClick();
              }
            }
            assert.equal(readPendingEmail(), null, `${mode} ${action} must discard the old session`);
            if (action !== 'abandon') assert.equal(navigations.at(-1).to, mode === 'google-link' ? '/login' : '/register');
          }
        }
        reset();
        delete window.setInterval;
        delete window.clearInterval;

        const callbacks = [];
        const clicks = [];
        window.google.accounts.id = {
          initialize(config) { assert.equal(config.client_id, 'local-ui-client'); assert.equal(config.nonce, 'ui-nonce'); callbacks.push(config.callback); },
          renderButton(element, config) { assert.equal(element, container); clicks.push(config.click_listener); },
        };
        const configured = () => GoogleSignIn({ intent: 'login' });
        const renderGoogle = () => { const element = configured(); return render(element.type, element.props); };
        const prepare = async () => {
          reply(200, { data: { challengeToken: 'ui-challenge', nonce: 'ui-nonce' } });
          renderGoogle(); await flush(); renderGoogle();
        };
        for (const result of [
          sessionResult,
          { kind: 'profile', registrationToken: 'profile-ui', email: pending.email, suggestedName: 'Suggested' },
          { ...registrationResult, kind: 'link_otp' },
        ]) {
          reset(); clearPendingEmail(); setSession(null);
          await prepare();
          reply(200, { data: result }, (config) => {
            assert.equal(config.url, '/auth/google');
            assert.deepEqual(JSON.parse(config.data), { challengeToken: 'ui-challenge', credential: 'local-mock-credential', intent: 'login' });
          });
          callbacks.at(-1)({ credential: 'local-mock-credential' });
          await flush(); renderGoogle();
          if (result.kind === 'session') {
            assert.equal(getSession().accessToken, result.accessToken);
            assert.equal(navigations.at(-1).to, '/my/products');
            assert.equal(readPendingEmail(), null);
          } else if (result.kind === 'profile') {
            assert.equal(elements(rendered).find((node) => node.props?.id === 'google-profile-email')?.props.readOnly, true);
            assert.equal(forms.at(-1).defaultValues.fullName, 'Suggested');
            assert.equal(readPendingEmail(), null);
            reply(200, { data: registrationResult });
            await forms.at(-1).onSubmit({ value: { fullName: 'Confirmed', phone: '' } });
            assert.deepEqual(readPendingEmail(), pending);
            assert.equal(navigations.at(-1).to, '/verify-otp');
          } else {
            assert.deepEqual(readPendingEmail(), { ...pending, mode: 'google-link' });
            assert.equal(navigations.at(-1).to, '/verify-otp');
          }
          assert.ok(![...storage.values()].some((value) => value.includes('local-mock-credential')));
        }
        reset(); clearPendingEmail(); setSession(null);
        await prepare();
        clicks.at(-1)(); renderGoogle();
        const abandoned = callbacks.at(-1);
        button('Hủy và thử lại').props.onClick();
        await prepare();
        let exchanges = 0;
        reply(500, { message: 'Try again' }, () => { exchanges++; });
        abandoned({ credential: 'abandoned-local-credential' });
        await flush();
        assert.equal(exchanges, 0);
        callbacks.at(-1)({}); renderGoogle();
        assert.ok(button('Thử lại đăng nhập Google'));
        button('Thử lại đăng nhập Google').props.onClick();
        await prepare();
        reply(500, { message: 'Try again' }, () => { exchanges++; });
        callbacks.at(-1)({ credential: 'local-mock-credential' });
        await flush(); renderGoogle();
        assert.equal(exchanges, 1);
        assert.ok(button('Thử lại đăng nhập Google'));
        const failed = callbacks.at(-1);
        button('Thử lại đăng nhập Google').props.onClick();
        await prepare();
        reply(200, { data: sessionResult }, () => { exchanges++; });
        failed({ credential: 'abandoned-local-credential' });
        callbacks.at(-1)({ credential: 'local-mock-credential' });
        callbacks.at(-1)({ credential: 'local-mock-credential' });
        await flush();
        assert.equal(exchanges, 2, 'retry uses one new challenge; old and duplicate callbacks are ignored');
        assert.equal(navigations.length, 1);
        reset(); delete globalThis.authUiCheck;
        setSession(session);
        console.log('PASS configured GIS callbacks: session, profile, link OTP, cancellation, retry, abandoned/duplicate callbacks');
      } finally {
        delete globalThis.authUiCheck;
        delete window.google;
        if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
        else delete globalThis.document;
      }
      console.log('PASS Google/registration contracts: public JSON POST, OTP modes, status guard, safe pending storage');
    }
    reply(201, { statusCode: 201, data: { id: 'p1' } }, (config) => {
      assert.equal(config.baseURL, '/api');
      assert.equal(config.headers.get('Authorization'), 'Bearer test-token');
    });
    assert.deepEqual(await requestJson({ url: '/my/products', method: 'POST', data: {} }),
      { data: { id: 'p1' } });
    reply(200, { data: [{ id: 'p1' }], meta });
    assert.deepEqual(await requestJson({ url: '/products' }), { data: [{ id: 'p1' }], meta });
    reply(200, new Blob(['binary']), (config) => assert.equal(config.responseType, 'blob'));
    assert.equal(await (await requestBlob('/my/products/p1/attachments/f1')).text(), 'binary');
    reply(401, new Blob([JSON.stringify({ message: 'Authentication required' })]));
    await assert.rejects(requestBlob('/my/products/p1/attachments/f1'), { status: 401 });
    assert.equal(getSession(), null);
    assert.equal(queryClient.getQueryData(queryKeys.myProducts.list), undefined);
    setSession(session);
    reply(201, { data: { id: 'file-1' } }, (config) => {
      assert.ok(config.data instanceof FormData);
      assert.ok(!config.headers.getContentType());
    });
    await requestJson({ url: '/my/products/p1/attachments', method: 'POST', data: form });
    for (const status of [403, 409, 413, 415, 429, 500]) {
      setSession(session);
      reply(status, { message: `failure-${status}` });
      await assert.rejects(requestJson({ url: '/my/products/p1' }),
        { status, message: `failure-${status}` });
      assert.ok(getSession());
    }
    setSession(session);
    redirects.length = 0;
    reply(401, { message: 'Current password is incorrect' });
    await assert.rejects(requestJson({ url: '/auth/change-password', method: 'POST' }),
      { status: 401 });
    assert.ok(getSession());
    assert.equal(redirects.length, 0);
    setSession(null);
    reply(401, { message: 'Invalid credentials' });
    await assert.rejects(requestJson({ url: '/auth/login', method: 'POST' }), { status: 401 });
    assert.equal(redirects.length, 0);
    baseRequest.defaults.adapter = async () => { throw new Error('Network Error'); };
    await assert.rejects(requestJson({ url: '/my/products' }), (error) =>
      !(error instanceof ApiError) && error.message === 'Network Error');
    reply(204, '');
    assert.deepEqual(await requestJson({ url: '/my/products/p1', method: 'DELETE' }), { data: null });
    reply(500, '<html>proxy error</html>');
    await assert.rejects(requestJson({ url: '/products' }),
      { status: 500, message: 'Request failed (500)' });
    setSession(session);
    queryClient.setQueryData(queryKeys.myProducts.list, [{ id: 'cached' }]);
    redirects.length = 0;
    reply(401, { message: 'Authentication required' });
    await assert.rejects(requestJson({ url: '/auth/me' }), { status: 401 });
    assert.equal(getSession(), null);
    assert.equal(storage.has('ocop-session'), false);
    assert.equal(queryClient.getQueryData(queryKeys.myProducts.list), undefined);
    assert.deepEqual(redirects, ['/login']);
    setSession(session);
    redirects.length = 0;
    reply(401, { message: 'Old token expired' }, () => {
      setSession({ ...session, accessToken: 'new-token' });
    });
    await assert.rejects(requestJson({ url: '/auth/me' }), { status: 401 });
    assert.equal(getSession().accessToken, 'new-token');
    assert.equal(redirects.length, 0);
    const retry = queryClient.getDefaultOptions().queries.retry;
    assert.equal(typeof retry, 'function');
    assert.equal(retry(0, new ApiError('conflict', 409)), false);
    assert.equal(retry(0, new ApiError('server', 500)), true);
    assert.equal(retry(0, new Error('network')), true);
    assert.equal(retry(1, new Error('network')), false);
    const { authApi, productsApi, myProductsApi, judgeApi, adminApi } =
      await server.ssrLoadModule('/src/api/index.ts');
    setSession(null);
    const loginResult = { accessToken: 'test-token', user: session.user };
    reply(200, { data: loginResult }, (config) => {
      assert.equal(config.url, '/auth/login');
      assert.equal(config.method, 'post');
      assert.deepEqual(JSON.parse(config.data), { email: 'a@example.invalid', password: 'secret' });
      assert.equal(config.headers.get('Authorization'), undefined);
    });
    assert.deepEqual(await authApi.login({ email: 'a@example.invalid', password: 'secret' }),
      { data: loginResult });
    setSession(session);
    reply(201, { data: { id: 'p1' } }, (config) => {
      assert.equal(config.url, '/my/products');
      assert.equal(config.method, 'post');
      assert.deepEqual(JSON.parse(config.data), {
        name: 'Chè', categoryId: 'c1', formData: {},
      });
    });
    assert.deepEqual(await myProductsApi.create({ name: 'Chè', categoryId: 'c1', formData: {} }),
      { data: { id: 'p1' } });
    reply(200, { data: [], meta }, (config) => {
      assert.equal(config.url, '/products');
      assert.deepEqual(config.params, { page: 2, limit: 20, q: 'chè & trà' });
    });
    assert.deepEqual(await productsApi.list({ page: 2, limit: 20, q: 'chè & trà' }),
      { data: [], meta });
    const productInput = { name: 'Chè', categoryId: 'c1', formData: { assessmentYear: 2026 } };
    reply(200, { data: { id: 'p1' } }, (config) => {
      assert.equal(config.url, '/my/products/p1');
      assert.equal(config.method, 'put');
      assert.deepEqual(JSON.parse(config.data), productInput);
    });
    await myProductsApi.update('p1', productInput);
    const assignmentInput = [{ judgeId: 'j1', categoryId: 'c1', criterionIds: [] }];
    reply(200, { data: [] }, (config) => {
      assert.equal(config.url, '/admin/assignments');
      assert.equal(config.method, 'put');
      assert.deepEqual(JSON.parse(config.data), { assignments: assignmentInput });
    });
    await adminApi.replaceAssignments(assignmentInput);
    const judgeCalls = [];
    baseRequest.defaults.adapter = async (config) => {
      judgeCalls.push({ url: config.url, method: config.method, data: config.data === undefined ? undefined : JSON.parse(config.data) });
      const data = config.url.endsWith('/submit')
        ? { data: { id: 'e1', status: 'SUBMITTED', total: 42 } }
        : { data: { id: 'e1', status: 'DRAFT', scores: [{ subCriterionId: 's1', optionId: 'o1', note: 'Giải trình' }] } };
      return { status: 200, statusText: '200', data, headers: {}, config };
    };
    const scores = [{ subCriterionId: 's1', optionId: 'o1', note: 'Giải trình' }];
    await judgeApi.save('p1', { scores });
    await judgeApi.submit('p1');
    assert.deepEqual(judgeCalls, [
      { url: '/judge/products/p1/evaluation', method: 'put', data: { scores } },
      { url: '/judge/products/p1/evaluation/submit', method: 'post', data: undefined },
    ]);
    setSession(session);
    const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    reply(201, { data: { id: 'f1' } }, (config) => {
      assert.equal(config.url, '/my/products/a%2Fb/attachments');
      assert.deepEqual([...config.data.keys()], ['file']);
      assert.equal(config.data.get('file').name, 'proof.pdf');
    });
    await myProductsApi.upload('a/b', proof);
    reply(200, new Blob(['private']), (config) => {
      assert.equal(config.url, '/my/products/a%2Fb/attachments/f1');
      assert.equal(config.responseType, 'blob');
      assert.equal(config.headers.get('Authorization'), 'Bearer test-token');
    });
    assert.equal(await (await myProductsApi.attachment('a/b', 'f1')).text(), 'private');
    console.log('PASS client: envelope, 201, multipart, blob, 401 session rules');
  }
} finally {
  restoreAxiosAdapter();
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else delete globalThis.window;
  if (previousLocalStorage) Object.defineProperty(globalThis, 'localStorage', previousLocalStorage);
  else delete globalThis.localStorage;
  await server.close();
}
