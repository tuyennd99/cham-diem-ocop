import { Link } from "@tanstack/react-router";
import { homeFor, useSession } from "../../lib/auth";

export function ForbiddenPage() {
  const session = useSession();
  const home = session ? homeFor(session.user.role) : "/";
  return <main className="route-main" id="content"><div className="container route-container"><section className="route-panel"><p className="eyebrow">403 · KHÔNG CÓ QUYỀN TRUY CẬP</p><h1>Bạn không thể mở trang này</h1><p>Hãy quay lại khu vực phù hợp với tài khoản của bạn.</p><Link className="button button-primary" to={home}>Quay lại khu vực của tôi</Link></section></div></main>;
}
