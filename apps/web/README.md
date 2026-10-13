# OCOP Đánh Giá · Claude Design Package

This reusable design package documents the source product, preserves implementation evidence, and provides focused review pages plus a working applied interface.

## Product Overview

OCOP Đánh Giá is a Vietnamese product registry and evaluation prototype. Its primary surfaces are a public dossier lookup, a product-detail dialog, an evaluation-process explanation, scoring criteria, and a product-owner account/submission demonstration. Core capabilities shown by the source include searching by product or dossier details, filtering by product group and status, paging results, inspecting origin and rating, and following the illustrative submission flow. The records, account, and form responses are sample content; they are not an official registry or persisted service.

The visual language uses a pale green-white canvas, leaf-green actions, quiet borders, amber rating signals, and local product photography. This keeps product identity, status, origin, and result legible together.

## Product Context and Source References

- [context/source-context.md](context/source-context.md) documents the source project, metadata, and copied-file inventory.
- [context/provenance.md](context/provenance.md) maps preserved images, natural dimensions, source credits, and evidence limits.
- [src/styles.css](src/styles.css) is the primary source for component styling and responsive behavior.
- [src/App.jsx](src/App.jsx), [src/DossierFilters.jsx](src/DossierFilters.jsx), [src/useDossierFilters.js](src/useDossierFilters.js), and [src/data.js](src/data.js) preserve the React surface, URL-backed filters, interaction behavior, and illustrative records.
- [ocop-danh-gia-landing.html](ocop-danh-gia-landing.html) preserves the standalone implementation and explicit token block; [index.html](index.html) preserves the original project entry point.

## Package Contents

- [DESIGN.md](DESIGN.md): product context and source-backed visual, component, interaction, and content rules.
- [SKILL.md](SKILL.md): discoverable instructions for future design and implementation work.
- [colors_and_type.css](colors_and_type.css): shared color, typography, spacing, radius, and shadow tokens.
- `assets/images/`: all seven original photographs and the local `cao-che-vang.png` display copy.
- `src/` and `ocop-danh-gia-landing.html`: substantial preserved source examples outside `context/` for implementation reference.
- `preview/`: nine standalone HTML review cards, shared preview styling, and the matching JSON manifest.
- `ui_kits/app/`: composed interactive lookup UI; modular dossier and pagination renderers live under `components/`.
- `context/`: source handoff and asset provenance.
- `fonts/`: no local font files were supplied; Google Fonts loading and fallback stacks follow the source.
- `build/`: no runtime icon bundle or other built assets were supplied, so no representative build files exist to preserve.

## Preview Manifest

Open [preview/index.html](preview/index.html) for the review hub, or open a focused card directly. Each entry lists its purpose and the source-backed component or asset it demonstrates.

| Exact path | Review purpose | Source-backed examples |
|---|---|---|
| [preview/index.html](preview/index.html) | Overview of palette, type, spacing, components, assets, and applied UI | Shared tokens and the applied lookup kit |
| [preview/colors-primary.html](preview/colors-primary.html) | Inspect palette values and semantic status colors | Source tokens; ranked, evaluating, and received states |
| [preview/typography-specimens.html](preview/typography-specimens.html) | Compare Vietnamese display, body, and metadata type | Lora, Be Vietnam Pro, JetBrains Mono, and dossier ID specimens |
| [preview/spacing-tokens.html](preview/spacing-tokens.html) | Review spacing rhythm, content width, and responsive gutters | 8/12/20/32/56/88px scale and source page rhythm |
| [preview/radius-shadows.html](preview/radius-shadows.html) | Review control, dossier, and dialog shapes | 8px media/controls, 14px panels, source dialog shadow |
| [preview/components-buttons.html](preview/components-buttons.html) | Inspect button, search, select, category, focus, and hover patterns | Source lookup controls and `DossierFilters` behavior |
| [preview/components-record-row.html](preview/components-record-row.html) | Review dossier identity, status, rating, image, and details action | Source honey record and its local product image |
| [preview/brand-assets.html](preview/brand-assets.html) | Confirm local imagery and natural image ratios | Preserved product photographs and the separately labeled generic wine photo |
| [preview/applied-ui.html](preview/applied-ui.html) | Exercise the complete composed lookup interface | URL filters, detail dialog, sample account and submission flow |

## Reuse and Review Workflow

1. Read [DESIGN.md](DESIGN.md) and [context/provenance.md](context/provenance.md) before adapting the visual language or product imagery.
2. Load [colors_and_type.css](colors_and_type.css) as the shared token source; keep the source-backed colors and font roles intact.
3. Start from [ui_kits/app/index.html](ui_kits/app/index.html) for the composed surface. Reuse the modules in `ui_kits/app/components/` and the matching source patterns in `src/`.
4. Keep the correct local image, natural dimensions, status, and rating attached to each dossier. Preserve the image credits and the visible sample-data notice.
5. Review each changed pattern in its matching standalone card from the Preview Manifest. Check keyboard focus and narrow layouts as well as the default state.
6. Keep the account and submission demonstrations explicitly local and simulated; do not present them as authentication or persisted data.

No separate official logo, app icon, tray icon, or local font file was included. The prototype's text-and-star mark remains part of the source UI only and is not described as an official brand asset.
