---
name: ocop-danh-gia-design-system
description: Apply the source-backed OCOP Đánh Giá visual system and dossier patterns to Vietnamese product registry and evaluation interfaces.
user-invocable: true
---

# OCOP Đánh Giá Design System

## What is inside

- `DESIGN.md` documents product context, color, typography, spacing, layout, components, motion, voice, and anti-patterns.
- `colors_and_type.css` is the shared implementation token source.
- `ui_kits/app/` is a composed lookup interface with reusable modules in `components/`.
- `preview/` contains focused review cards for tokens, type, spacing, shapes, controls, dossier rows, local images, and the applied interface.
- `src/` and `ocop-danh-gia-landing.html` preserve substantive source implementations. `context/provenance.md` records asset mapping and source limits.

## Source context

This package is derived from the copied `Landing Page OCOP` React/Vite prototype and standalone HTML. Read `context/source-context.md` for the handoff inventory and `context/provenance.md` for the evidence and local image credits. Product records and account flows are demonstrations, not official registry data or persisted services. No official logo, runtime icon bundle, or local font files were supplied.

## When to use this skill

Use it when extending or reviewing an OCOP product lookup, evaluation dossier, product-owner submission, or related interface that should remain consistent with the captured prototype. Do not apply its product-specific patterns to unrelated brands without adapting the content and evidence.

## How to use

1. Read `DESIGN.md` and `context/provenance.md` before changing visual or content patterns.
2. Load `colors_and_type.css`; do not replace source-backed colors or font stacks with arbitrary values.
3. Start from the matching applied-kit module or focused page in `preview/`, preserving accessible labels, focus states, and responsive behavior.
4. Keep dossier identity, origin, status, and rating tied to the same record. An unrated record must say it has no result.
5. Use the correct local product image at its natural ratio and retain image credit. Do not use the generic wine-gathering photo as a product image.
6. Keep sample-data notes visible and describe local account/submission interactions as simulations.
7. Review the corresponding focused preview card after changes; see `README.md` for the full preview manifest and reuse workflow.

## Design system highlights

- **Color:** pale green-white canvas (`#f7faf8`), dark forest ink (`#12281b`), leaf-green action (`#166534`), quiet borders (`#dce5df`), and amber result stars (`#d97706`). Small amber labels use the darker `--gold-text` token.
- **Type:** Lora for display headings, Be Vietnam Pro for Vietnamese UI and body copy, and JetBrains Mono for IDs and compact metadata.
- **Spacing and shape:** use the evidenced 8, 12, 20, 32, 56, and 88px spacing scale; 8px controls/media and 14px dossier panels; content width is 1160px with responsive gutters.
- **Core patterns:** labeled search and status controls, pressed-state category filters, source-ratio dossier photography, text-labeled status badges, optional ratings, pagination, and a native detail dialog.
- **Interaction:** keep targets at least 44px, provide visible focus, preserve valid lookup filters in the URL, and honor reduced-motion preferences.
