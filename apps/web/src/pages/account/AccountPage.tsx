import { Link } from '@tanstack/react-router';
import { errorText } from '../../lib/api-error';
import { useMe } from '../../queries/common';

export function AccountPage() {
  const { data: user, error: loadError } = useMe();
  const error = errorText(loadError);
  return (
    <section className='route-panel'>
      <p className='eyebrow'>TÀI KHOẢN</p>
      <h1>Thông tin tài khoản</h1>
      {error && (
        <p role='alert' className='form-note'>
          {error}
        </p>
      )}
      {user && (
        <dl className='detail-facts'>
          <div>
            <dt>Họ tên</dt>
            <dd>{user.fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Số điện thoại</dt>
            <dd>{user.phone || 'Chưa cập nhật'}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>{user.role}</dd>
          </div>
          <div>
            <dt>Xác thực</dt>
            <dd>{user.verified ? 'Đã xác thực' : 'Chưa xác thực'}</dd>
          </div>
        </dl>
      )}
      <p>
        <Link className='text-link' to='/account/password'>
          Đổi mật khẩu
        </Link>
      </p>
    </section>
  );
}
