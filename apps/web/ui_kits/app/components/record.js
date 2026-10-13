const statusClass = { ranked: "ranked", evaluating: "evaluating", received: "received" };

export function statusBadge(record) {
  return `<span class="badge status-${statusClass[record.status]}" data-od-id="status-${record.slug}">${record.statusLabel}</span>`;
}

export function rating(record) {
  if (!record.rating) return `<p class="no-rating" data-od-id="rating-${record.slug}">Chưa có kết quả xếp hạng</p>`;
  const stars = "★".repeat(record.rating);
  const empty = "☆".repeat(5 - record.rating);
  return `<div class="rating-block" data-od-id="rating-${record.slug}"><strong>${record.rating} sao</strong><span class="stars" role="img" aria-label="${record.rating} trên 5 sao"><span aria-hidden="true">${stars}<span class="stars-empty">${empty}</span></span></span></div>`;
}

export function dossierRow(record) {
  return `<article class="record-row" data-od-id="record-card-${record.slug}">
    <div class="record-media" style="aspect-ratio:${record.width}/${record.height}"><img src="${record.image}" width="${record.width}" height="${record.height}" alt="${record.alt}" loading="lazy" decoding="async"></div>
    <div class="record-main"><div class="record-badges"><span class="badge badge-category">${record.categoryLabel}</span>${statusBadge(record)}</div>
      <h3 data-od-id="record-heading-${record.slug}">${record.name}</h3><p class="record-origin">${record.origin}</p>
      <dl class="record-facts"><div><dt>Mã hồ sơ</dt><dd>${record.id}</dd></div><div><dt>Đơn vị</dt><dd>${record.applicant}</dd></div></dl>
    </div><div class="record-result">${rating(record)}<a class="button button-secondary detail-link" href="#/products/${record.slug}" data-product-open="${record.slug}" data-od-id="record-detail-link-${record.slug}" aria-label="Xem hồ sơ ${record.id}, ${record.name}">Xem hồ sơ</a></div>
  </article>`;
}
