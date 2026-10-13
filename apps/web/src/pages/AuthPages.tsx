import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, jsonBody, messageOf } from "../api";
import { setSession, type AppRole, type SessionUser } from "../auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginResponse { accessToken: string; user: SessionUser }

function destination(role: AppRole) {
  return role === "ADMIN" ? "/admin/products" : role === "JUDGE" ? "/judge" : "/my/products";
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
      const { data } = await api<LoginResponse>("/auth/login", { method: "POST", body: jsonBody({ email: form.get("email"), password: form.get("password") }) });
      setSession({ accessToken: data.accessToken, user: data.user });
      await navigate({ to: destination(data.user.role) });
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
    <p>Chưa có tài khoản? <Link className="text-link" to="/register">Đăng ký</Link></p>
  </AuthFrame>;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const emailValue = String(form.get("email") ?? "").trim().toLowerCase();
    try {
      await api("/auth/register", { method: "POST", body: jsonBody({ email: emailValue, fullName: form.get("fullName"), phone: form.get("phone") || undefined, password: form.get("password") }) });
      setEmail(emailValue); setSent(true);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const code = new FormData(event.currentTarget).get("code");
    try {
      await api("/auth/verify-otp", { method: "POST", body: jsonBody({ email, code }) });
      await navigate({ to: "/login" });
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <AuthFrame eyebrow="TÀI KHOẢN OCOP" title={sent ? "Xác thực email" : "Đăng ký tài khoản"} intro={sent ? `Nhập mã 6 chữ số đã gửi tới ${email}. Mã có hiệu lực trong 5 phút.` : "Tạo tài khoản chủ thể để lập và gửi hồ sơ sản phẩm OCOP."}>
    {!sent ? <form className="account-form" onSubmit={register}>
      <label>Tên chủ thể<Input name="fullName" autoComplete="organization" maxLength={255} required /></label>
      <label>Email<Input name="email" type="email" autoComplete="email" required onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Số điện thoại <span>(không bắt buộc)</span><Input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
      <label>Mật khẩu<Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
      {error && <p className="form-note" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Tạo tài khoản"}</Button>
    </form> : <form className="account-form" onSubmit={verify}>
      <label>Mã OTP<Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
      {error && <p className="form-note" role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Đang xác thực…" : "Xác thực tài khoản"}</Button>
    </form>}
    <p>Đã có tài khoản? <Link className="text-link" to="/login">Đăng nhập</Link></p>
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
      const { data } = await api<{ message: string }>("/auth/forgot-password", { method: "POST", body: jsonBody({ email: value }) });
      setEmail(value); setNotice(data.message); setSent(true);
    } catch (error) { setError(messageOf(error)); }
    finally { setBusy(false); }
  }
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/auth/reset-password", { method: "POST", body: jsonBody({ email, code: form.get("code"), newPassword: form.get("password") }) });
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; api<SessionUser>("/auth/me").then(({ data }) => { if (active) setUser(data); }).catch((e) => { if (active) setError(messageOf(e)); }); return () => { active = false; }; }, []);
  return <section className="route-panel"><p className="eyebrow">TÀI KHOẢN</p><h1>Thông tin tài khoản</h1>{error && <p role="alert" className="form-note">{error}</p>}{user && <dl className="detail-facts"><div><dt>Họ tên</dt><dd>{user.fullName}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Số điện thoại</dt><dd>{user.phone || "Chưa cập nhật"}</dd></div><div><dt>Vai trò</dt><dd>{user.role}</dd></div><div><dt>Xác thực</dt><dd>{user.verified ? "Đã xác thực" : "Chưa xác thực"}</dd></div></dl>}</section>;
}
