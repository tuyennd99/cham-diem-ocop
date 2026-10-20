import { Link } from "@tanstack/react-router";
import { getSession, homeFor } from "../lib/auth";

export function ForbiddenPage() {
  const session = getSession();
  const home = session ? homeFor(session.user.role) : "/";
  return <main className="route-main" id="content"><div className="container route-container"><section className="route-panel"><p className="eyebrow">403 · KHÔNG CÓ QUYỀN TRUY CẬP</p><h1>Bạn không thể mở trang này</h1><p>Hãy quay lại khu vực phù hợp với tài khoản của bạn.</p><Link className="button button-primary" to={home}>Quay lại khu vực của tôi</Link></section></div></main>;
}

export function NotFoundPage() {
  return <main className="route-main" id="content"><div className="container route-container"><section className="route-panel"><p className="eyebrow">404 · KHÔNG TÌM THẤY TRANG</p><h1>Trang này không tồn tại</h1><p>Đường dẫn có thể đã thay đổi hoặc không còn khả dụng.</p><Link className="button button-primary" to="/">Về trang chủ</Link></section></div></main>;
}
