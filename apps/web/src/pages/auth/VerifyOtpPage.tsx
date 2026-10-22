import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { authApi } from "../../api";
import { messageOf } from "../../lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthFrame } from "./AuthFrame";
import { clearPendingEmail, readPendingEmail, writePendingEmail } from "./pending-email";

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
      await authApi.verifyOtp({ email: normalizedEmail, code });
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
      await authApi.resendOtp(email.trim().toLowerCase());
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
      await authApi.resendOtp(nextEmail);
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
