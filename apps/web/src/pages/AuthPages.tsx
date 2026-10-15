import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError, messageOf } from "../api";
import { homeFor, setSession, type SessionUser } from "../auth";
import { useApi } from "../use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginResponse { accessToken: string; user: SessionUser }

function readPendingEmail() {
  try { return window.sessionStorage.getItem("ocop.pendingEmail") ?? ""; } catch { return ""; }
}

function writePendingEmail(email: string) {
  try { window.sessionStorage.setItem("ocop.pendingEmail", email); } catch { /* Storage can be disabled; keep verification usable. */ }
}

function clearPendingEmail() {
  try { window.sessionStorage.removeItem("ocop.pendingEmail"); } catch { /* Verification should still succeed. */ }
}

function AuthFrame({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return <main className="route-main" id="content"><div className="container route-container"><section className="route-panel" aria-labelledby="route-title"><p className="eyebrow">{eyebrow}</p><h1 id="route-title">{title}</h1><p className="route-intro">{intro}</p>{children}</section></div></main>;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await api<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      setSession({ accessToken: data.accessToken, user: data.user });
      await navigate({ to: homeFor(data.user.role) });
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow="TÀI KHOẢN OCOP" title="Đăng nhập" intro="Dùng email đã xác thực để tiếp tục làm việc với hồ sơ.">
    <form className="account-form" onSubmit={submit}>
      <label>Email<Input name="email" type="email" autoComplete="email" required /></label>
      <label>Mật khẩu<Input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p className="form-note" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
    </form>
    <p><Link className="text-link" to="/forgot-password">Quên mật khẩu?</Link></p>
    <p><Link className="text-link" to="/verify-otp">Cần xác thực email?</Link></p>
    <p>Chưa có tài khoản? <Link className="text-link" to="/register">Đăng ký</Link></p>
  </AuthFrame>;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const emailValue = String(form.get("email") ?? "").trim().toLowerCase();
    writePendingEmail(emailValue);
    try {
      await api("/auth/register", { method: "POST", body: JSON.stringify({ email: emailValue, fullName: form.get("fullName"), phone: form.get("phone") || undefined, password: form.get("password") }) });
      await navigate({ to: "/verify-otp" });
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow="TÀI KHOẢN OCOP" title="Đăng ký tài khoản" intro="Tạo tài khoản chủ thể để lập và gửi hồ sơ sản phẩm OCOP.">
    <form className="account-form" onSubmit={register}>
      <label>Tên chủ thể<Input name="fullName" autoComplete="organization" maxLength={255} required /></label>
      <label>Email<Input name="email" type="email" autoComplete="email" required /></label>
      <label>Số điện thoại <span>(không bắt buộc)</span><Input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
      <label>Mật khẩu<Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
      {error && <p className="form-note" role="alert">{error}</p>}
      {error && <p><Link className="text-link" to="/verify-otp">Xác thực email hoặc gửi lại mã</Link></p>}
      <Button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Tạo tài khoản"}</Button>
    </form>
    <p>Đã có tài khoản? <Link className="text-link" to="/login">Đăng nhập</Link></p>
  </AuthFrame>;
}

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(readPendingEmail);
  const [replacementEmail, setReplacementEmail] = useState("");
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setEmailError(""); setCodeError("");
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setEmailError("Nhập email dùng khi đăng ký."); return; }
    if (!/^\d{6}$/.test(code)) { setCodeError("Mã xác thực gồm đúng 6 chữ số."); return; }
    setVerifying(true);
    try {
      await api("/auth/verify-otp", { method: "POST", body: JSON.stringify({ email: normalizedEmail, code }) });
      clearPendingEmail(); setSuccess(true);
    } catch (cause) {
      const message = messageOf(cause);
      if (/otp|code|mã|hết hạn|expired|invalid/i.test(message)) setCodeError("Mã không đúng hoặc đã hết hạn. Hãy kiểm tra email hoặc gửi mã mới.");
      else setError(message);
    } finally { setVerifying(false); }
  }

  async function resend() {
    if (secondsLeft > 0 || verifying || resending || !email.trim()) return;
    setResending(true); setError("");
    try {
      await api("/auth/resend-otp", { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      setSecondsLeft(60);
      setError("Nếu email có đăng ký đang chờ xác thực, mã mới sẽ được gửi.");
    } catch { setError("Chưa thể gửi mã lúc này. Vui lòng thử lại sau."); }
    finally { setResending(false); }
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = replacementEmail.trim().toLowerCase();
    if (!nextEmail) { setEmailError("Nhập email hợp lệ."); return; }
    setResending(true); setError(""); setEmailError("");
    try {
      await api("/auth/resend-otp", { method: "POST", body: JSON.stringify({ email: nextEmail }) });
      setEmail(nextEmail); setCode(""); setCodeError(""); setSecondsLeft(60);
      writePendingEmail(nextEmail);
      setError("Nếu email có đăng ký đang chờ xác thực, mã mới sẽ được gửi.");
    } catch { setError("Chưa thể gửi mã lúc này. Vui lòng thử lại sau."); }
    finally { setResending(false); }
  }

  return <AuthFrame eyebrow="TÀI KHOẢN OCOP" title="Xác thực email" intro="Nhập mã 6 chữ số để hoàn tất đăng ký.">
    {success ? <div className="auth-success"><p role="status" aria-live="polite">Email đã được xác thực.</p><Button onClick={() => void navigate({ to: "/login" })}>Đến đăng nhập</Button></div> : <form className="account-form" onSubmit={verify}>
      <label>Email<Input name="email" type="email" autoComplete="email" value={email} readOnly aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "otp-email-error" : undefined} required /></label>
      {emailError && <p className="field-error" id="otp-email-error">{emailError}</p>}
      <label>Mã xác thực<Input name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-invalid={Boolean(codeError)} aria-describedby={codeError ? "otp-code-error" : undefined} required /></label>
      {codeError && <p className="field-error" id="otp-code-error">{codeError}</p>}
      {error && <p className="form-note" role="status" aria-live="polite">{error}</p>}
      <Button type="submit" disabled={verifying || resending}>{verifying ? "Đang xác thực…" : "Xác thực email"}</Button>
      <Button type="button" variant="secondary" disabled={verifying || resending || secondsLeft > 0 || !email.trim()} onClick={() => void resend()}>{resending ? "Đang gửi mã…" : secondsLeft > 0 ? `Gửi lại mã sau ${secondsLeft}s` : "Gửi lại mã"}</Button>
    </form>}
    {!success && <details className="change-email"><summary>Đổi email nhận mã</summary><form className="account-form" onSubmit={(event) => void changeEmail(event)}><label>Email mới<Input type="email" autoComplete="email" value={replacementEmail} onChange={(event) => setReplacementEmail(event.target.value)} required /></label><p>Chỉ email đã có đăng ký đang chờ xác thực mới nhận được mã. Muốn tạo đăng ký bằng email khác, hãy <Link className="text-link" to="/register">quay lại đăng ký</Link>.</p><Button type="submit" variant="secondary" disabled={verifying || resending}>{resending ? "Đang gửi mã…" : "Gửi mã tới email này"}</Button></form></details>}
    <p><Link className="text-link" to="/login">Quay lại đăng nhập</Link></p>
  </AuthFrame>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const value = String(new FormData(event.currentTarget).get("email") ?? "").trim().toLowerCase();
    try {
      const { data } = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: value }) });
      setEmail(value); setNotice(data.message); setSent(true);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, code: form.get("code"), newPassword: form.get("password") }) });
      setNotice("Đã đổi mật khẩu. Bạn có thể đăng nhập.");
      setSent(false);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow="KHÔI PHỤC TÀI KHOẢN" title="Quên mật khẩu" intro={sent ? `Nhập mã trong email gửi tới ${email} và đặt mật khẩu mới.` : "Nhận mã xác thực qua email để đặt lại mật khẩu."}>
    {!sent ? <form className="account-form" onSubmit={sendCode}>
      <label>Email<Input name="email" type="email" autoComplete="email" required /></label>
      {notice && <p className="form-note" role="status">{notice}</p>}{error && <p className="form-note" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi mã xác thực"}</Button>
    </form> : <form className="account-form" onSubmit={reset}>
      <label>Mã OTP<Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
      <label>Mật khẩu mới<Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
      {error && <p className="form-note" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Đang lưu…" : "Đặt lại mật khẩu"}</Button>
    </form>}
    <p><Link className="text-link" to="/login">Quay lại đăng nhập</Link></p>
  </AuthFrame>;
}

export function AccountPage() {
  const { result, error } = useApi<SessionUser>("/auth/me");
  const user = result?.data;
  return <section className="route-panel"><p className="eyebrow">TÀI KHOẢN</p><h1>Thông tin tài khoản</h1>{error && <p role="alert" className="form-note">{error}</p>}{user && <dl className="detail-facts"><div><dt>Họ tên</dt><dd>{user.fullName}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Số điện thoại</dt><dd>{user.phone || "Chưa cập nhật"}</dd></div><div><dt>Vai trò</dt><dd>{user.role}</dd></div><div><dt>Xác thực</dt><dd>{user.verified ? "Đã xác thực" : "Chưa xác thực"}</dd></div></dl>}<p><Link className="text-link" to="/account/password">Đổi mật khẩu</Link></p></section>;
}

export function ChangePasswordPage() {
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (newPassword.length < 8) { setError("Mật khẩu mới cần có ít nhất 8 ký tự."); return; }
    if (newPassword !== confirmPassword) { setError("Mật khẩu nhập lại chưa khớp."); return; }
    setBusy(true);
    try {
      await api("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      formElement.reset(); setSession(null); window.location.replace("/login");
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401 ? "Mật khẩu hiện tại không đúng." : messageOf(cause));
    } finally { setBusy(false); }
  }

  function visibility(key: keyof typeof show, label: string) {
    return <button type="button" className="password-toggle" aria-pressed={show[key]} onClick={() => setShow((value) => ({ ...value, [key]: !value[key] }))}>{show[key] ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}</button>;
  }

  return <section className="route-panel password-page"><p className="eyebrow">TÀI KHOẢN</p><h1>Đổi mật khẩu</h1><p>Chọn mật khẩu mới có ít nhất 8 ký tự.</p>
    <form className="account-form" onSubmit={submit}>
      <label>Mật khẩu hiện tại<Input name="currentPassword" type={show.current ? "text" : "password"} autoComplete="current-password" maxLength={72} required />{visibility("current", "mật khẩu hiện tại")}</label>
      <label>Mật khẩu mới<Input name="newPassword" type={show.next ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} required />{visibility("next", "mật khẩu mới")}</label>
      <label>Nhập lại mật khẩu mới<Input name="confirmPassword" type={show.confirm ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={72} required />{visibility("confirm", "mật khẩu nhập lại")}</label>
      {error && <p className="form-note" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Đang cập nhật…" : "Cập nhật mật khẩu"}</Button>
    </form>
    <p><Link className="text-link" to="/account">Quay lại tài khoản</Link></p>
  </section>;
}
