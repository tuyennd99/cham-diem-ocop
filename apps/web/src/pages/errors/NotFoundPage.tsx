import { Link } from "@tanstack/react-router";

export function NotFoundPage() {
  return <main className="route-main" id="content"><div className="container route-container"><section className="route-panel"><p className="eyebrow">404 · KHÔNG TÌM THẤY TRANG</p><h1>Trang này không tồn tại</h1><p>Đường dẫn có thể đã thay đổi hoặc không còn khả dụng.</p><Link className="button button-primary" to="/">Về trang chủ</Link></section></div></main>;
}
