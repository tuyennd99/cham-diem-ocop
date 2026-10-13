export function pagination(page, pageCount) {
  if (pageCount < 2) return "";
  const numbers = Array.from({ length: pageCount }, (_, i) => i + 1).map((n) =>
    `<button class="page-number${n === page ? " current" : ""}" type="button" data-page="${n}" data-od-id="page-number-${n}" aria-label="Trang ${n}"${n === page ? ' aria-current="page"' : ""}>${n}</button>`
  ).join("");
  return `<button class="button button-secondary" type="button" data-page="${page - 1}" data-od-id="page-previous"${page === 1 ? " disabled" : ""}>Trang trước</button>${numbers}<span class="page-count" data-od-id="page-count" aria-live="polite">Trang ${page} / ${pageCount}</span><button class="button button-secondary" type="button" data-page="${page + 1}" data-od-id="page-next"${page === pageCount ? " disabled" : ""}>Trang sau</button>`;
}
