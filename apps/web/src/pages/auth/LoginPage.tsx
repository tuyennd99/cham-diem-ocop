import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authApi } from "../../api";
import { messageOf } from "../../lib/api-error";
import { homeFor, setSession } from "../../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthFrame } from "./AuthFrame";

export function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await authApi.login({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      setSession({ accessToken: data.accessToken, user: data.user });
      await navigate({ to: homeFor(data.user.role, data.user.staffPermissions) });
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
