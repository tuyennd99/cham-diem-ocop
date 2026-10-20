import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError, messageOf } from "../lib/api";
import { homeFor, setSession, validatePasswordBytes } from "../lib/auth";
import { useApi } from "../lib/use-api";
import type { LoginResponse, SessionUser } from "../types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function readPendingEmail() {
  try { return window.sessionStorage.getItem("ocop.pendingEmail") ?? ""; } catch { return ""; }
}

function writePendingEmail(email: string) {
  try { window.sessionStorage.setItem("ocop.pendingEmail", email); } catch { /* Storage can be disabled; keep verification usable. */ }
}

function clearPendingEmail() {
  try { window.sessionStorage.removeItem("ocop.pendingEmail"); } catch { /* Verification should still succeed. */ }
}

function AuthFrame({
  eyebrow,
  title,
  intro,
  mode,
  aside,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  mode?: "login" | "register";
  aside?: ReactNode;
  children: ReactNode;
}) {
  const panel = (
    <section className="route-panel auth-panel" aria-labelledby="route-title">
      {mode && (
        <div className="auth-tabs" aria-label="Chuyển đổi đăng nhập và đăng ký">
          <Link
            className={`auth-tab${mode === "login" ? " is-active" : ""}`}
            to="/login"
            aria-current={mode === "login" ? "page" : undefined}
          >
            Đăng nhập
          </Link>
          <Link
            className={`auth-tab${mode === "register" ? " is-active" : ""}`}
            to="/register"
            aria-current={mode === "register" ? "page" : undefined}
          >
            Đăng ký tài khoản
          </Link>
        </div>
      )}
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="route-title">{title}</h1>
      <p className="route-intro">{intro}</p>
      {children}
    </section>
  );

  return (
    <main className="route-main" id="content">
      <div className="container route-container">
        {aside ? (
          <div className="auth-grid">
            {panel}
            {aside}
          </div>
        ) : (
          panel
        )}
      </div>
    </main>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
  const loginAside = (
    <aside className="auth-aside" aria-label="Phân quyền hệ thống">
      <p className="eyebrow">KHU VỰC HỆ THỐNG</p>
      <h2>Làm việc theo vai trò được phân quyền</h2>
      <p className="auth-aside-lead">Hệ thống tự động chuyển hướng tới không gian làm việc tương ứng ngay sau khi đăng nhập thành công:</p>
      <ol className="auth-steps">
        <li className="auth-step">
          <span className="step-number">VAI TRÒ · CHỦ THỂ</span>
          <h3>Chủ thể sản xuất (Hợp tác xã, hộ kinh doanh, doanh nghiệp)</h3>
          <p>Quản lý danh mục sản phẩm của đơn vị, tạo hồ sơ mới, tải lên tài liệu minh chứng và xem phiếu tổng hợp điểm.</p>
        </li>
        <li className="auth-step">
          <span className="step-number">VAI TRÒ · GIÁM KHẢO</span>
          <h3>Giám khảo hội đồng chấm điểm</h3>
          <p>Truy cập danh sách hồ sơ được phân công, đối chiếu minh chứng và chấm điểm từng tiêu chí theo Quyết định 26/2026/QĐ-TTg.</p>
        </li>
        <li className="auth-step">
          <span className="step-number">VAI TRÒ · QUẢN TRỊ</span>
          <h3>Quản trị viên hệ thống</h3>
          <p>Tiếp nhận hồ sơ, phân công giám khảo theo nhóm tiêu chí và công bố kết quả xếp hạng sản phẩm OCOP.</p>
        </li>
      </ol>
      <div className="auth-aside-meta">
        <div>
          <strong>Cần kích hoạt tài khoản mới?</strong>
          <span>Nếu vừa đăng ký nhưng chưa nhập mã OTP 6 chữ số, hãy chuyển tới trang <Link className="text-link" to="/verify-otp">Xác thực email</Link>.</span>
        </div>
      </div>
    </aside>
  );

  return <AuthFrame eyebrow="TÀI KHOẢN OCOP" title="Đăng nhập" intro="Dùng email đã xác thực để tiếp tục làm việc với hồ sơ sản phẩm hoặc hội đồng chấm điểm." mode="login" aside={loginAside}>
    <form className="account-form" onSubmit={submit}>
      <label>
        <span className="field-label-row">Email</span>
        <Input name="email" type="email" autoComplete="email" placeholder="Ví dụ: lienhe@htxcheshan.vn" required />
      </label>
      <label>
        <span className="field-label-row">Mật khẩu</span>
        <div className="password-input-group">
          <Input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Nhập mật khẩu của bạn" required />
          <button type="button" className="password-visibility-btn" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? "Ẩn" : "Hiện"}
          </button>
        </div>
      </label>
      {error && (
        <div className="form-alert" role="alert">
          <strong>Không thể đăng nhập</strong>
          <p>{error}</p>
        </div>
      )}
      <Button type="submit" className="auth-submit-btn" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</Button>
    </form>
    <div className="auth-card-footer">
      <div className="auth-help-links">
        <Link className="text-link" to="/forgot-password">Quên mật khẩu?</Link>
        <Link className="text-link" to="/verify-otp">Cần xác thực email?</Link>
      </div>
      <p className="auth-switch-prompt">Chưa có tài khoản? <Link className="text-link" to="/register">Đăng ký</Link></p>
    </div>
  </AuthFrame>;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const emailValue = String(form.get("email") ?? "").trim().toLowerCase();
    const passwordValue = String(form.get("password") ?? "");
    try {
      validatePasswordBytes(passwordValue);
      writePendingEmail(emailValue);
      await api("/auth/register", { method: "POST", body: JSON.stringify({ email: emailValue, fullName: form.get("fullName"), phone: form.get("phone") || undefined, password: passwordValue }) });
      await navigate({ to: "/verify-otp" });
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  const registerAside = (
    <aside className="auth-aside" aria-label="Hướng dẫn đăng ký tài khoản chủ thể OCOP">
      <p className="eyebrow">HƯỚNG DẪN CHỦ THỂ</p>
      <h2>3 bước chuẩn bị và nộp hồ sơ OCOP</h2>
      <p className="auth-aside-lead">Tài khoản chủ thể giúp hợp tác xã, doanh nghiệp và hộ sản xuất lưu trữ hồ sơ trực tuyến và theo dõi kết quả chấm điểm minh bạch.</p>
      <ol className="auth-steps">
        <li className="auth-step">
          <span className="step-number">BƯỚC 01 · KÍCH HOẠT</span>
          <h3>Xác thực email nhận thông báo</h3>
          <p>Sau khi gửi biểu mẫu đăng ký, nhập mã gồm 6 chữ số được gửi tới hộp thư để kích hoạt tài khoản chủ thể.</p>
        </li>
        <li className="auth-step">
          <span className="step-number">BƯỚC 02 · KHAI BÁO HỒ SƠ</span>
          <h3>Lập hồ sơ &amp; đính kèm minh chứng</h3>
          <p>Khai báo thông tin sản phẩm, xuất xứ địa phương, câu chuyện sản phẩm và tải lên tài liệu minh chứng theo từng nhóm tiêu chí.</p>
        </li>
        <li className="auth-step">
          <span className="step-number">BƯỚC 03 · TRA CỨU KẾT QUẢ</span>
          <h3>Theo dõi tiến độ chấm điểm và sao đạt</h3>
          <p>Xem trạng thái tiếp nhận, điểm chi tiết theo Quyết định 26/2026/QĐ-TTg (thang 100 điểm) và mức xếp hạng từ 1 đến 5 sao.</p>
        </li>
      </ol>
      <div className="auth-aside-meta">
        <div>
          <strong>Căn cứ áp dụng</strong>
          <span>Bộ tiêu chí đánh giá, phân hạng sản phẩm OCOP theo Quyết định số 26/2026/QĐ-TTg.</span>
        </div>
        <Link className="text-link" to="/products">Xem danh sách hồ sơ công khai →</Link>
      </div>
    </aside>
  );

  return <AuthFrame eyebrow="TÀI KHOẢN OCOP" title="Đăng ký tài khoản" intro="Tạo tài khoản chủ thể để lập và gửi hồ sơ sản phẩm OCOP." mode="register" aside={registerAside}>
    <form className="account-form" onSubmit={register}>
      <label>
        <span className="field-label-row">Tên chủ thể</span>
        <span className="field-hint">Ghi đúng tên hợp tác xã, doanh nghiệp hoặc hộ sản xuất kinh doanh trên giấy phép.</span>
        <Input name="fullName" autoComplete="organization" placeholder="Ví dụ: Hợp tác xã Chè Shan Tuyết Pà Cò" maxLength={255} required />
      </label>
      <label>
        <span className="field-label-row">Email</span>
        <span className="field-hint">Hệ thống sẽ gửi mã OTP gồm 6 chữ số tới địa chỉ email này để kích hoạt tài khoản.</span>
        <Input name="email" type="email" autoComplete="email" placeholder="Ví dụ: lienhe@htxcheshan.vn" required />
      </label>
      <label>
        <span className="field-label-row">
          <span>Số điện thoại</span>
          <span className="field-optional">(không bắt buộc)</span>
        </span>
        <span className="field-hint">Dùng để hội đồng chấm điểm liên hệ khi cần đối chiếu bổ sung hồ sơ minh chứng.</span>
        <Input name="phone" type="tel" autoComplete="tel" placeholder="Ví dụ: 0912 345 678" maxLength={30} />
      </label>
      <label>
        <span className="field-label-row">Mật khẩu</span>
        <span className="field-hint">Tối thiểu 8 ký tự (tối đa 72 ký tự).</span>
        <div className="password-input-group">
          <Input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Nhập mật khẩu từ 8 ký tự trở lên" minLength={8} maxLength={72} required />
          <button type="button" className="password-visibility-btn" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>
            {showPassword ? "Ẩn" : "Hiện"}
          </button>
        </div>
      </label>
      {error && (
        <div className="form-alert" role="alert">
          <strong>Không thể hoàn tất đăng ký</strong>
          <p>{error}</p>
          <p><Link className="text-link" to="/verify-otp">Xác thực email hoặc gửi lại mã →</Link></p>
        </div>
      )}
      <Button type="submit" className="auth-submit-btn" disabled={busy}>{busy ? "Đang gửi…" : "Tạo tài khoản"}</Button>
    </form>
    <div className="auth-card-footer">
      <p className="auth-switch-prompt">Đã có tài khoản? <Link className="text-link" to="/login">Đăng nhập</Link></p>
      <div className="auth-help-links">
        <Link className="text-link" to="/verify-otp">Đã đăng ký nhưng chưa nhập mã OTP? Xác thực email</Link>
      </div>
    </div>
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
    const newPassword = String(form.get("password") ?? "");
    try {
      validatePasswordBytes(newPassword);
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, code: form.get("code"), newPassword }) });
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
      validatePasswordBytes(currentPassword);
      validatePasswordBytes(newPassword);
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
