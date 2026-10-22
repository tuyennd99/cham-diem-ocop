import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authApi } from "../../api";
import { messageOf } from "../../lib/api-error";
import { validatePasswordBytes } from "../../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthFrame } from "./AuthFrame";

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
      const { data } = await authApi.forgotPassword(value);
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
      await authApi.resetPassword({ email, code: String(form.get("code") ?? ""), newPassword });
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
