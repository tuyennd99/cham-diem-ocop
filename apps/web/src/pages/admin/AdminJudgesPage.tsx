import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { adminApi } from "../../api";
import { errorText, messageOf } from "../../lib/api-error";
import { validatePasswordBytes } from "../../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryKeys } from "../../constants/query-key";
import { useAdminJudges } from "../../queries/admin";
import type { AdminJudge as Judge } from "../../types/admin";

export function AdminJudgesPage() {
  const queryClient = useQueryClient();
  const { data: judges = [], error: loadError } = useAdminJudges();
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const error = actionError || errorText(loadError);
  const refreshJudges = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    setActionError(""); setNotice(""); setBusy(true);
    const form = new FormData(formElement);
    const password = String(form.get("password") ?? "");
    try {
      validatePasswordBytes(password);
      await adminApi.createJudge({
        email: String(form.get("email") ?? ""),
        fullName: String(form.get("fullName") ?? ""),
        phone: String(form.get("phone") ?? "") || undefined,
        password,
      });
      formElement.reset(); setNotice("Đã tạo tài khoản giám khảo."); await refreshJudges();
    } catch (e) { setActionError(messageOf(e)); } finally { setBusy(false); }
  }
  async function update(judge: Judge, form: HTMLFormElement) {
    if (busy) return;
    const data = new FormData(form);
    setActionError(""); setNotice(""); setBusy(true);
    try {
      await adminApi.updateJudge(judge.id, {
        fullName: String(data.get("fullName") ?? ""),
        phone: String(data.get("phone") ?? "") || null,
      });
      setNotice("Đã cập nhật giám khảo."); await refreshJudges();
    } catch (e) { setActionError(messageOf(e)); } finally { setBusy(false); }
  }
  async function resetPassword(judge: Judge, form: HTMLFormElement) {
    if (busy) return;
    const password = String(new FormData(form).get("password") ?? "");
    setActionError(""); setNotice(""); setBusy(true);
    try {
      validatePasswordBytes(password);
      await adminApi.resetJudgePassword(judge.id, { password });
      form.reset(); setNotice("Đã đặt mật khẩu mới.");
    } catch (e) { setActionError(messageOf(e)); } finally { setBusy(false); }
  }
  async function deactivate(judge: Judge) {
    if (busy || !window.confirm(`Ngừng hoạt động tài khoản ${judge.email}?`)) return;
    setActionError(""); setNotice(""); setBusy(true);
    try {
      await adminApi.deactivateJudge(judge.id);
      await refreshJudges();
    } catch (e) { setActionError(messageOf(e)); } finally { setBusy(false); }
  }
  return <section><p className="eyebrow">QUẢN TRỊ</p><h1>Quản lý giám khảo</h1>{error && <p role="alert" className="form-note">{error}</p>}{notice && <p role="status">{notice}</p>}<section className="route-panel"><h2>Tạo tài khoản giám khảo</h2><form className="account-form" onSubmit={create}><label>Họ tên<Input name="fullName" maxLength={255} required /></label><label>Email<Input name="email" type="email" maxLength={320} required /></label><label>Số điện thoại<Input name="phone" type="tel" maxLength={30} /></label><label>Mật khẩu tạm thời<Input name="password" type="password" minLength={12} maxLength={72} required /></label><Button disabled={busy}>{busy ? "Đang tạo…" : "Tạo giám khảo"}</Button></form></section><h2>Danh sách giám khảo</h2><div className="record-list">{judges.map((judge) => <article className="route-panel" key={judge.id}><form className="account-form" onSubmit={(e) => { e.preventDefault(); void update(judge, e.currentTarget); }}><strong>{judge.email} · {judge.isActive ? "Đang hoạt động" : "Đã ngừng"}</strong><label>Họ tên<Input name="fullName" defaultValue={judge.fullName} maxLength={255} required /></label><label>Số điện thoại<Input name="phone" defaultValue={judge.phone ?? ""} maxLength={30} /></label><Button variant="secondary" disabled={busy}>Lưu thay đổi</Button></form><form className="account-form" onSubmit={(e) => { e.preventDefault(); void resetPassword(judge, e.currentTarget); }}><label>Đặt mật khẩu mới<Input name="password" type="password" minLength={12} maxLength={72} required /></label><Button variant="secondary" disabled={busy}>Đặt lại mật khẩu</Button></form>{judge.isActive && <Button variant="secondary" disabled={busy} onClick={() => void deactivate(judge)}>Ngừng hoạt động</Button>}</article>)}</div></section>;
}
