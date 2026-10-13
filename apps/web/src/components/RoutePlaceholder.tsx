export function RoutePlaceholder({ title }: { title: string }) {
  return (
    <section className="route-panel" aria-labelledby="route-title">
      <p className="eyebrow">OCOP · BẢN MẪU</p>
      <h1 id="route-title">{title}</h1>
      <p className="route-intro">Đường dẫn đã sẵn sàng. Nội dung sẽ được nối với quy trình và API tương ứng.</p>
    </section>
  );
}
