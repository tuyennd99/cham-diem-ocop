import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminApi } from '../../api';
import { queryKeys } from '../../constants/query-key';
import { errorText, messageOf } from '../../lib/api-error';
import { validatePasswordBytes } from '../../lib/auth';
import { optionalText } from '../../lib/utils';
import { useAdminJudges } from '../../queries/admin';
import type { AdminJudge as Judge } from '../../types/admin';

interface JudgeCardProps {
  judge: Judge;
  busy: boolean;
  onUpdate: (judge: Judge, values: { fullName: string; phone: string }) => Promise<void>;
  onResetPassword: (judge: Judge, password: string) => Promise<boolean>;
  onDeactivate: (judge: Judge) => Promise<void>;
}

function JudgeCard({ judge, busy, onUpdate, onResetPassword, onDeactivate }: JudgeCardProps) {
  const updateForm = useForm({
    defaultValues: { fullName: judge.fullName, phone: judge.phone ?? '' },
    onSubmit: async ({ value }) => {
      await onUpdate(judge, value);
    },
  });

  const resetForm = useForm({
    defaultValues: { password: '' },
    onSubmit: async ({ value }) => {
      const ok = await onResetPassword(judge, value.password);
      if (ok) resetForm.reset();
    },
  });

  return (
    <article className='route-panel'>
      <form
        className='account-form'
        onSubmit={(event) => {
          event.preventDefault();
          void updateForm.handleSubmit();
        }}
      >
        <strong>
          {judge.email} · {judge.isActive ? 'Đang hoạt động' : 'Đã ngừng'}
        </strong>
        <updateForm.Field name='fullName'>
          {(field) => (
            <label>
              Họ tên
              <Input
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                maxLength={255}
                required
              />
            </label>
          )}
        </updateForm.Field>
        <updateForm.Field name='phone'>
          {(field) => (
            <label>
              Số điện thoại
              <Input
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                maxLength={30}
              />
            </label>
          )}
        </updateForm.Field>
        <Button type='submit' variant='secondary' disabled={busy}>
          Lưu thay đổi
        </Button>
      </form>
      <form
        className='account-form'
        onSubmit={(event) => {
          event.preventDefault();
          void resetForm.handleSubmit();
        }}
      >
        <resetForm.Field name='password'>
          {(field) => (
            <label>
              Đặt mật khẩu mới
              <Input
                name={field.name}
                type='password'
                minLength={12}
                maxLength={72}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                required
              />
            </label>
          )}
        </resetForm.Field>
        <Button type='submit' variant='secondary' disabled={busy}>
          Đặt lại mật khẩu
        </Button>
      </form>
      {judge.isActive && (
        <Button variant='secondary' disabled={busy} onClick={() => void onDeactivate(judge)}>
          Ngừng hoạt động
        </Button>
      )}
    </article>
  );
}

export function AdminJudgesPage() {
  const queryClient = useQueryClient();
  const { data: judges = [], error: loadError } = useAdminJudges();
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const error = actionError || errorText(loadError);
  const refreshJudges = () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });

  const createForm = useForm({
    defaultValues: { fullName: '', email: '', phone: '', password: '' },
    onSubmit: async ({ value }) => {
      if (busy) return;
      setActionError('');
      setNotice('');
      setBusy(true);
      try {
        validatePasswordBytes(value.password);
        await adminApi.createJudge({
          email: value.email,
          fullName: value.fullName,
          phone: optionalText(value.phone),
          password: value.password,
        });
        createForm.reset();
        setNotice('Đã tạo tài khoản giám khảo.');
        await refreshJudges();
      } catch (cause) {
        setActionError(messageOf(cause));
      } finally {
        setBusy(false);
      }
    },
  });

  async function updateJudge(judge: Judge, values: { fullName: string; phone: string }) {
    if (busy) return;
    setActionError('');
    setNotice('');
    setBusy(true);
    try {
      await adminApi.updateJudge(judge.id, {
        fullName: values.fullName,
        phone: optionalText(values.phone) ?? null,
      });
      setNotice('Đã cập nhật giám khảo.');
      await refreshJudges();
    } catch (cause) {
      setActionError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resetJudgePassword(judge: Judge, password: string): Promise<boolean> {
    if (busy) return false;
    setActionError('');
    setNotice('');
    setBusy(true);
    try {
      validatePasswordBytes(password);
      await adminApi.resetJudgePassword(judge.id, { password });
      setNotice('Đã đặt mật khẩu mới.');
      return true;
    } catch (cause) {
      setActionError(messageOf(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deactivateJudge(judge: Judge) {
    if (busy || !window.confirm(`Ngừng hoạt động tài khoản ${judge.email}?`)) return;
    setActionError('');
    setNotice('');
    setBusy(true);
    try {
      await adminApi.deactivateJudge(judge.id);
      await refreshJudges();
    } catch (cause) {
      setActionError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <p className='eyebrow'>QUẢN TRỊ</p>
      <h1>Quản lý giám khảo</h1>
      {error && (
        <p role='alert' className='form-note'>
          {error}
        </p>
      )}
      {notice && <p role='status'>{notice}</p>}
      <section className='route-panel'>
        <h2>Tạo tài khoản giám khảo</h2>
        <form
          className='account-form'
          onSubmit={(event) => {
            event.preventDefault();
            void createForm.handleSubmit();
          }}
        >
          <createForm.Field name='fullName'>
            {(field) => (
              <label>
                Họ tên
                <Input
                  name={field.name}
                  maxLength={255}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
              </label>
            )}
          </createForm.Field>
          <createForm.Field name='email'>
            {(field) => (
              <label>
                Email
                <Input
                  name={field.name}
                  type='email'
                  maxLength={320}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
              </label>
            )}
          </createForm.Field>
          <createForm.Field name='phone'>
            {(field) => (
              <label>
                Số điện thoại
                <Input
                  name={field.name}
                  type='tel'
                  maxLength={30}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </label>
            )}
          </createForm.Field>
          <createForm.Field name='password'>
            {(field) => (
              <label>
                Mật khẩu tạm thời
                <Input
                  name={field.name}
                  type='password'
                  minLength={12}
                  maxLength={72}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  required
                />
              </label>
            )}
          </createForm.Field>
          <Button type='submit' disabled={busy}>
            {busy ? 'Đang tạo…' : 'Tạo giám khảo'}
          </Button>
        </form>
      </section>
      <h2>Danh sách giám khảo</h2>
      <div className='record-list'>
        {judges.map((judge) => (
          <JudgeCard
            key={judge.id}
            judge={judge}
            busy={busy}
            onUpdate={updateJudge}
            onResetPassword={resetJudgePassword}
            onDeactivate={deactivateJudge}
          />
        ))}
      </div>
    </section>
  );
}
