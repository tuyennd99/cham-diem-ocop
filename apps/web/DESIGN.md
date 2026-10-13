# OCOP Đánh Giá Design System

## Product context

OCOP Đánh Giá is a Vietnamese product registry and evaluation prototype. Its public-facing surface helps people find sample dossiers, understand processing status, and read star ratings. The source also demonstrates a submission path for product owners. All product records and account flows in the prototype are explicitly illustrative.

The system should feel grounded, legible, and accountable. Product photography supplies local context; the interface itself stays restrained so status, origin, dossier ID, and rating remain easy to compare.

## Visual foundations

Use a pale green-white canvas, clean white surfaces, deep leaf-green actions, and a restrained amber signal for star results. Keep borders quiet and layouts open. The palette below is converted from the source CSS values into OKLCH; `colors_and_type.css` is the implementation source of truth.

| Role | Token | Source value / use |
|---|---|---|
| Page | `--bg` | `#f7faf8` |
| Surface | `--surface` | `#ffffff` |
| Soft surface | `--surface-soft` | `#f0f5f1` |
| Main text | `--fg` | `#12281b` |
| Supporting text | `--muted` | `#496353` |
| Border | `--border` | `#dce5df` |
| Primary action | `--accent` | `#166534` |
| Star / rating | `--gold` | `#d97706`; use `--gold-text` for small text |
| Error | `--danger` | `#9a3412` |

Status tones are semantic: completed/ranked uses the amber family; in-progress uses the green family; received uses the cool neutral family. Do not use a star count to imply a result when a record has none. Use the darker ink token for small amber labels and the brighter amber for stars or large marks.

## Color

The values below come from the token block in `ocop-danh-gia-landing.html` and the component rules in `src/styles.css`; `colors_and_type.css` carries them into the package. Keep the cool, low-chroma canvas and dark green ink together. Use amber for rating results and small supporting marks.

| Token | Source value | Applied use |
|---|---|---|
| `--bg` | `#f7faf8` | Page canvas |
| `--surface` | `#ffffff` | Search fields, dialogs, and surfaces |
| `--surface-soft` | `#f0f5f1` | Quiet inset areas |
| `--fg` | `#12281b` | Main text |
| `--muted` | `#496353` | Supporting copy and metadata |
| `--border` | `#dce5df` | Dividers and controls |
| `--accent` / `--accent-hover` | `#166534` / `#104b27` | Primary action and hover |
| `--gold` / `--gold-text` | `#d97706` / `#854d0e` | Stars / readable small rating labels |
| `--danger` | `#9a3412` | Error feedback |

The source status mapping uses amber for ranked records, green for evaluation in progress, and cool neutral tones for received records. Every badge keeps a text label, so color is never the only status cue. Derived soft and inverse colors remain in OKLCH in the token stylesheet.

## Typography

The source uses three families to make interface roles distinct:

| Role | Stack | Use |
|---|---|---|
| Display | `Lora`, Charter, Georgia, serif | Page and section headings; a calm editorial note |
| Body | `Be Vietnam Pro`, system sans-serif | Vietnamese UI, labels, paragraphs, and controls |
| Mono | `JetBrains Mono`, system monospace | Dossier IDs, dates, compact metadata, and eyebrow labels |

Base body copy is 16px with a 1.6 line height. Leads are 18px. Metadata is 13px. Headings use the fluid scales in `colors_and_type.css`; keep Vietnamese diacritics and wrap naturally instead of forcing a single line.

## Spacing and shape

Use the evidenced spacing scale: 8, 12, 20, 32, 56, and 88px. The content container is 1160px with 28px side gutters, reducing to 20px and then 16px at smaller screens. Give major sections generous vertical spacing; keep controls and repeated rows compact enough to scan.

Controls and media wells use an 8px radius. Larger dossier rows, panels, and dialogs use 14px. Borders define ordinary surfaces; reserve the deep dialog shadow for overlays. Avoid adding elevation to every card.

## Layout and composition

- The header stays visible while scrolling. Desktop navigation sits between the wordmark and account actions; compact layouts collapse it into an accessible menu.
- The hero pairs a clear task statement with a short explanation of how shared status and rating data work.
- The lookup surface uses labeled search and status controls, a pressed-state category group, a result count, then dossier rows.
- A dossier row keeps the product image at its intrinsic ratio, places identity and origin in the flexible center column, and keeps rating and detail access in a consistent end column.
- Workflow steps and three evaluation groups use simple grids with clear reading order. Grids collapse to a single column on narrow screens.
- Detail content opens in a native dialog and remains linkable through the record route. Login and application forms are clearly labeled as demonstrations.
- Keep the main reading width around 1160px. The source React page also uses a wider 1360px container in dense areas; reserve that width for data-heavy surfaces where it improves scanning.

## Components

| Component | Pattern and states |
|---|---|
| Primary button | Leaf-green fill, white label, 44px minimum height. Darken the background on hover; keep the label white. |
| Secondary button | White fill and quiet border. Hover adds green border and pale-green surface. |
| Search / select | Persistent visible label, 46px minimum height, white fill, clear border, green focus border and focus ring. |
| Category filter | Rounded outline buttons with `aria-pressed`; selected state uses pale green and a green border. |
| Status badge | Compact pill with text and a semantic surface/ink pair. Never rely on color alone. |
| Dossier row | Natural-ratio product photo, category/status badges, name, origin, ID and applicant; optional rating, then a secondary details action. |
| Rating | Amber star marks plus a numeric accessible label. Unrated records show “Chưa có kết quả xếp hạng”. |
| Pagination | 44px page targets, current page marked with `aria-current="page"`, disabled ends remain explicit. |
| Detail dialog | Native `<dialog>`, bounded to the viewport, with close button, Escape support, factual record fields, and a visible sample-data note. |
| Empty state | Plain message and a next step to revise search or filters; do not fabricate results. |

Use one primary action for one task in a viewport. Secondary navigation and detail links remain quiet. All focusable controls need a visible `:focus-visible` ring. Respect reduced-motion preferences; transitions are short and limited to color and border feedback.

## Motion and interaction

Use 180ms ease-out transitions for button background, border, and color. Menu state should update `aria-expanded`. Filters should update the visible count and preserve valid values in the URL. Product detail should support direct links and normal browser back behavior. No motion is required to communicate status. Under `prefers-reduced-motion: reduce`, remove smooth scrolling and reduce transitions to near zero.

## Voice and content

Write concise, direct Vietnamese labels and explain the next step in plain terms. Use consistent terms: “hồ sơ”, “trạng thái”, “đang đánh giá”, “đã tiếp nhận”, and “đã xếp hạng”. State clearly when data is a demonstration. Keep dates, identifiers, applicant names, and star results tied to the same record. Avoid claims that a demonstration is an official score or live registry.

## Anti-patterns

- Do not introduce gradients, decorative agriculture illustrations, or extra accent colors; the source relies on product photography and a compact green/amber palette.
- Do not use bright amber for small body text; use `--gold-text` for readable labels.
- Do not show a rating for a record that has no result, or detach status from its dossier.
- Do not crop product packaging or replace a named product with generic imagery. Preserve natural image ratios and the full frame.
- Do not turn every section into an elevated rounded card. Keep criteria and workflow sections open and ordered.
- Do not hide form labels, reduce touch targets below 44px, or weaken contrast in hover/focus states.
- Do not present sample accounts or local-only form submission as authentication or server persistence.
