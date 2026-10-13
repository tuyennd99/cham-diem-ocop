import { dossierRow } from "./components/record.js";
import { pagination as renderPagination } from "./components/pagination.js";

(function () {
  const records = [
    { id: "HS-26-0012", slug: "mat-ong-u-minh", name: "Mật ong rừng U Minh", category: "food", categoryLabel: "Thực phẩm", origin: "Cà Mau", applicant: "HTX Minh họa Miền Tây", status: "ranked", statusLabel: "Đã xếp hạng", stage: "Đã tổng hợp phiếu", updated: "12/10/2026", rating: 5, image: "../../assets/images/mat-ong-u-minh.jpg", width: 600, height: 450, alt: "Chai mật ong rừng U Minh Sinifood", note: "Hồ sơ minh họa đã có kết quả xếp hạng trong dữ liệu mẫu." },
    { id: "HS-26-0011", slug: "nuoc-mam-phu-quoc", name: "Nước mắm Phú Quốc truyền thống", category: "food", categoryLabel: "Thực phẩm", origin: "Phú Quốc, An Giang", applicant: "HTX Minh họa Ven Biển", status: "ranked", statusLabel: "Đã xếp hạng", stage: "Đã tổng hợp phiếu", updated: "08/10/2026", rating: 5, image: "../../assets/images/nuoc-mam-phu-quoc.jpg", width: 450, height: 600, alt: "Chai nước mắm Phú Quốc Phú Hà", note: "Hồ sơ minh họa đã có kết quả xếp hạng trong dữ liệu mẫu." },
    { id: "HS-26-0010", slug: "tra-shan-tuyet", name: "Hồng trà Shan Tuyết Suối Giàng", category: "drink", categoryLabel: "Đồ uống", origin: "Văn Chấn, Yên Bái", applicant: "HTX Minh họa Suối Giàng", status: "ranked", statusLabel: "Đã xếp hạng", stage: "Đã tổng hợp phiếu", updated: "06/10/2026", rating: 4, image: "../../assets/images/tra-shan-tuyet.jpg", width: 2000, height: 2000, alt: "Hộp trà Shan Tuyết Suối Giàng, nhãn OCOP 4 sao", note: "Dữ liệu mẫu hiển thị kết quả 4 sao; ảnh sản phẩm cũng ghi OCOP 4 sao." },
    { id: "HS-26-0009", slug: "toi-den-ly-son", name: "Tỏi đen cô đơn Lý Sơn", category: "herbal", categoryLabel: "Thảo dược", origin: "Lý Sơn, Quảng Ngãi", applicant: "HTX Minh họa Đảo Xanh", status: "ranked", statusLabel: "Đã xếp hạng", stage: "Đã tổng hợp phiếu", updated: "02/10/2026", rating: 4, image: "../../assets/images/toi-den-ly-son.jpg", width: 2048, height: 2048, alt: "Hũ tỏi đen cô đơn Lý Sơn Dori", note: "Hồ sơ minh họa đã có kết quả xếp hạng trong dữ liệu mẫu." },
    { id: "HS-26-0008", slug: "ruou-sim-phu-quoc", name: "Rượu sim rừng Phú Quốc", category: "drink", categoryLabel: "Đồ uống", origin: "Phú Quốc, An Giang", applicant: "HTX Minh họa Sim Biển", status: "evaluating", statusLabel: "Đang đánh giá", stage: "Chờ giám khảo nộp phiếu", updated: "30/09/2026", rating: null, image: "../../assets/images/ruou-sim-phu-quoc.png", width: 600, height: 800, alt: "Chai rượu sim Phú Quốc Bảy Gáo", note: "Hồ sơ đang được đánh giá; dữ liệu mẫu chưa có kết quả xếp hạng." },
    { id: "HS-26-0007", slug: "cao-che-vang", name: "Cao chè vằng Quảng Trị", category: "herbal", categoryLabel: "Thảo dược", origin: "Cam Lộ, Quảng Trị", applicant: "HTX Minh họa Dược Liệu", status: "received", statusLabel: "Đã tiếp nhận", stage: "Đã tiếp nhận hồ sơ", updated: "27/09/2026", rating: null, image: "../../assets/images/cao-che-vang.png", width: 240, height: 240, alt: "Hộp và lọ cao chè vằng Mai Thị Thủy", note: "Hồ sơ minh họa đã tiếp nhận; chưa có kết quả xếp hạng." }
  ];
  const categories = [{ id: "all", label: "Tất cả" }, { id: "food", label: "Thực phẩm" }, { id: "drink", label: "Đồ uống" }, { id: "herbal", label: "Thảo dược" }];
  const pageSize = 4;
  const search = document.getElementById("recordSearch");
  const status = document.getElementById("recordStatus");
  const filters = document.getElementById("recordFilters");
  const list = document.getElementById("recordList");
  const count = document.getElementById("resultCount");
  const pagination = document.getElementById("pagination");
  const dialog = document.getElementById("recordDialog");
  const authPanels = document.getElementById("authPanels");
  const applicationPanel = document.getElementById("applicationPanel");
  let category = "all";
  let page = 1;

  function restoreUrl() {
    const params = new URLSearchParams(location.search);
    search.value = params.get("q") || "";
    category = categories.some((item) => item.id === params.get("category")) ? params.get("category") : "all";
    status.value = ["all", "ranked", "evaluating", "received"].includes(params.get("status")) ? params.get("status") : "all";
    const pageParam = params.get("page");
    page = pageParam && /^[1-9]\d*$/.test(pageParam) ? Number(pageParam) : 1;
  }

  function writeUrl() {
    const url = new URL(location.href);
    const params = url.searchParams;
    search.value ? params.set("q", search.value) : params.delete("q");
    category !== "all" ? params.set("category", category) : params.delete("category");
    status.value !== "all" ? params.set("status", status.value) : params.delete("status");
    page > 1 ? params.set("page", String(page)) : params.delete("page");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }

  function renderFilters() {
    filters.innerHTML = categories.map((item) => `<button class="filter-button${category === item.id ? " selected" : ""}" type="button" data-filter="${item.id}" data-od-id="category-filter-${item.id}" aria-pressed="${category === item.id}">${item.label}</button>`).join("");
  }

  function render() {
    const query = search.value.trim().toLocaleLowerCase("vi");
    const matches = records.filter((record) => (category === "all" || record.category === category) && (status.value === "all" || record.status === status.value) && [record.id, record.name, record.applicant, record.origin, record.statusLabel].some((value) => value.toLocaleLowerCase("vi").includes(query)));
    const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.min(page, pageCount);
    writeUrl();
    const offset = (page - 1) * pageSize;
    const visible = matches.slice(offset, offset + pageSize);
    list.innerHTML = visible.length ? visible.map(dossierRow).join("") : `<div class="empty-state" data-od-id="empty-state"><h3 data-od-id="empty-state-heading">Chưa tìm thấy hồ sơ</h3><p>Thử từ khóa khác hoặc chọn lại nhóm sản phẩm và trạng thái.</p></div>`;
    count.textContent = matches.length ? `Đang hiển thị ${offset + 1}–${Math.min(offset + pageSize, matches.length)} trong ${matches.length} hồ sơ minh họa.` : "Không có hồ sơ phù hợp. Hãy đổi từ khóa hoặc bộ lọc.";
    pagination.innerHTML = renderPagination(page, pageCount);
    renderFilters();
  }

  function setAccountMode(mode) {
    const registering = mode === "register";
    document.getElementById("registerForm").hidden = !registering;
    document.getElementById("loginForm").hidden = registering;
    document.querySelectorAll("[data-account-tab]").forEach((button) => {
      const selected = button.dataset.accountTab === mode;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function completeDemoAuth(event) {
    event.preventDefault();
    authPanels.hidden = true;
    applicationPanel.hidden = false;
    const status = document.getElementById("accountStatus");
    status.textContent = "Đăng nhập mô phỏng thành công. Dữ liệu không được gửi hoặc lưu.";
    status.hidden = false;
    document.getElementById("productName").focus();
  }

  function openRecord(record) {
    document.getElementById("dialogTitle").textContent = record.name;
    document.getElementById("dialogDescription").textContent = record.note;
    const media = document.getElementById("dialogMedia");
    media.style.aspectRatio = `${record.width} / ${record.height}`;
    media.innerHTML = `<img src="${record.image}" width="${record.width}" height="${record.height}" alt="${record.alt}">`;
    document.getElementById("dialogFacts").innerHTML = [
      ["Mã hồ sơ", record.id], ["Nhóm sản phẩm", record.categoryLabel], ["Đơn vị minh họa", record.applicant],
      ["Địa phương", record.origin], ["Bước xử lý", record.stage], ["Cập nhật mẫu", record.updated],
      ["Trạng thái", record.statusLabel], ["Kết quả", record.rating ? `${record.rating} sao` : "Chưa có kết quả xếp hạng"]
    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
    if (!dialog.open) dialog.showModal();
  }

  function closeRecord() {
    if (dialog.open) dialog.close();
    if (location.hash.startsWith("#/products/")) {
      if (history.state?.recordId) history.back();
      else history.replaceState(null, "", `${location.pathname}${location.search}#lookup`);
    }
  }

  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    category = button.dataset.filter;
    page = 1;
    render();
  });
  search.addEventListener("input", () => { page = 1; render(); });
  status.addEventListener("change", () => { page = 1; render(); });
  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    page = Number(button.dataset.page);
    render();
  });
  list.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-product-open]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const record = records.find((item) => item.slug === link.dataset.productOpen);
    if (!record) return;
    history.pushState({ recordId: record.slug }, "", `${location.pathname}${location.search}#/products/${record.slug}`);
    openRecord(record);
  });
  document.getElementById("dialogClose").addEventListener("click", closeRecord);
  document.getElementById("dialogDone").addEventListener("click", closeRecord);
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeRecord(); });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeRecord(); });
  document.querySelectorAll("[data-account-tab]").forEach((button) => button.addEventListener("click", () => setAccountMode(button.dataset.accountTab)));
  document.querySelectorAll("[data-account-mode]").forEach((link) => link.addEventListener("click", () => setAccountMode(link.dataset.accountMode)));
  document.querySelectorAll("[data-auth-form]").forEach((form) => form.addEventListener("submit", completeDemoAuth));
  document.getElementById("applicationForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const status = document.getElementById("applicationStatus");
    status.textContent = "Đã ghi nhận thao tác minh họa. Dữ liệu không được gửi hoặc lưu.";
    status.hidden = false;
  });
  window.addEventListener("popstate", () => {
    restoreUrl();
    render();
    if (!location.hash.startsWith("#/products/") && dialog.open) dialog.close();
    const match = location.hash.match(/^#\/products\/([a-z0-9-]+)$/);
    if (match) {
      const record = records.find((item) => item.slug === match[1]);
      if (record) openRecord(record);
    }
  });
  document.getElementById("menuToggle").addEventListener("click", (event) => {
    const open = document.getElementById("headerInner").classList.toggle("menu-open");
    event.currentTarget.setAttribute("aria-expanded", String(open));
    event.currentTarget.setAttribute("aria-label", open ? "Đóng điều hướng" : "Mở điều hướng");
  });
  document.querySelectorAll("#primaryNav a").forEach((link) => link.addEventListener("click", () => {
    document.getElementById("headerInner").classList.remove("menu-open");
    document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
    document.getElementById("menuToggle").setAttribute("aria-label", "Mở điều hướng");
  }));

  restoreUrl();
  render();
  const directMatch = location.hash.match(/^#\/products\/([a-z0-9-]+)$/);
  if (directMatch) {
    const record = records.find((item) => item.slug === directMatch[1]);
    if (record) openRecord(record);
  }
})();
