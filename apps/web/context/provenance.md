# Source and provenance

## Source project

- Name: Landing Page OCOP
- Project id: `3a007f74-1a42-4036-93be-ed2534da78d2`
- New design-system project: `d9b5db65-9cf6-4e45-bd37-6e963f7b93bc`
- Source design system: none
- Source implementation: React/Vite prototype plus a standalone HTML build

## Evidence used

- `src/styles.css` supplies the working React component styling and the primary responsive behavior.
- `src/App.jsx`, `src/DossierFilters.jsx`, `src/useDossierFilters.js`, and `src/data.js` document the component tree, URL-backed lookup, sample records, and interaction flow.
- `ocop-danh-gia-landing.html` contains an explicit token block, spacing scale, and a second implementation of the lookup and detail dialog.
- `index.html` records the original font loading and metadata.
- Original source files remain preserved at the project root and under `src/`.

## Asset map

All images are preserved in `assets/images/`. Dimensions were read from the local files and are retained on the corresponding preview images.

| Local file | Depicts | Source credit recorded in the prototype |
|---|---|---|
| `mat-ong-u-minh.jpg` | Sinifood U Minh forest honey bottle | [Sinifood](https://sinifoods.com/mat-ong-rung-u-minh) |
| `nuoc-mam-phu-quoc.jpg` | Phú Hà Phú Quốc fish sauce bottle | [TR Mart](https://trmartpq.kiotvietweb.vn/c/2501-gia-vi/p/phu-ha-nuoc-mam-phu-quoc-40-dam-510ml-fish-sauce-ea7f6c) |
| `tra-shan-tuyet.jpg` | Shan Tuyết Suối Giàng tea package | [SugiTea](https://sugitea.com/bach-tra-shan-tuyet-co-thu) |
| `toi-den-ly-son.jpg` | Dori Lý Sơn black garlic jar | [Dori](https://dori.com.vn/products/toi-den-co-don-ly-son-dori-hu-thuy-tinh-100g-toi-den-mot-tep-ly-son) |
| `ruou-sim-phu-quoc.png` | Bảy Gáo Phú Quốc sim wine bottle and box | [Đặc Sản Việt 98](https://dacsanviet98.com/products/ruou-sim-phu-quoc-14-do) |
| `cao-che-vang.jpg` and local display copy `cao-che-vang.png` | Mai Thị Thủy cao chè vằng jar and package | [OCOP Store](https://ocopstore.com/cao-che-vang-co-dac-mai-thi-thuy-hop-100gr) |
| `ruou-sim-phu-quoc.jpg` | Wine glasses at a gathering; generic source photograph | Preserved as supplied; not used for the named product record |

The standalone prototype and React app both cite these image sources. The package retains those credits; original usage/licensing terms were not included in the handoff.

## Derived decisions

- Token colors preserve the explicit source palette, represented in OKLCH in `colors_and_type.css`.
- Typography and spacing scales follow the declarations in the source CSS and the explicit token block in the standalone HTML.
- The wine record uses the local PNG that visibly shows the named Bảy Gáo product. The generic wine-glass JPG remains available as source evidence but is not used as a factual product image.
- The cao chè vằng JPG remains untouched; its PNG display copy preserves the same 240×240 photograph for reliable embedded-preview decoding.
- The source contains a text-and-star brand mark but no separate official logo, application icon, tray icon, or local font file. No substitute mark or icon asset was invented.
