import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authApi } from "../../api";
import { ApiError, messageOf } from "../../lib/api-error";
import { setSession, validatePasswordBytes } from "../../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      await authApi.changePassword({ currentPassword, newPassword });
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
