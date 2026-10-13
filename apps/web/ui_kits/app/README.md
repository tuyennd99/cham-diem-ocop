# Applied OCOP lookup kit

This is the source-backed, framework-free interface kit for reviewing and reusing the OCOP Đánh Giá product lookup.

## Applied kit structure

- `index.html` mounts the composed page: responsive navigation, lookup controls, dossier results, workflow, evaluation criteria, demo account forms, product-submission form, and native detail dialog. It loads `../../colors_and_type.css` and contains embedded review CSS; `app.css` carries the complete responsive interface styling.
- `app.js` connects search, category/status filters, URL state, paging, product detail routes, browser history, the mobile menu, and local-only demo form responses.
- `components.js` is a compatibility re-export for consumers that import the component bundle.

## Component files

- `components/record.js` exports the status badge, rating, and image-led dossier-row renderers.
- `components/pagination.js` exports previous/next controls and numbered pages with disabled and current-page semantics.
- `app.css` contains full layout, component states, focus styling, and mobile breakpoints.

The entry point imports the two renderers directly from `components/`, so the examples show modular use rather than a static screenshot.

## Usage workflow

1. Serve the project through its local preview or development server, then open `ui_kits/app/index.html`; browser ES modules need a local HTTP origin.
2. Load `../../colors_and_type.css` before app styling and reuse its tokens instead of adding a parallel palette.
3. Copy the semantic region needed from `index.html`, import the corresponding renderer from `components/`, and preserve its `data-od-id` hooks.
4. Keep visible form labels, minimum 44px targets, keyboard-operable native dialog behavior, focus rings, and the responsive row collapse.
5. Replace sample records only with verified data and the matching local product image. Preserve its intrinsic ratio and credit in `context/provenance.md`.
6. Compare changes with the relevant standalone page in `../../preview/` and update `../README.md` if the package surface changes.

## Design notes

The kit follows a pale green-white canvas, leaf-green primary actions, quiet borders, and amber rating marks. Lora headings, Be Vietnam Pro body copy, and JetBrains Mono identifiers follow the source roles. Dossier identity, origin, status, and rating stay in one row; records without a result say so explicitly. The sample notice stays visible.

## Source basis

The applied patterns come from `src/App.jsx`, `src/DossierFilters.jsx`, `src/useDossierFilters.js`, `src/data.js`, and `src/styles.css`, cross-checked against `ocop-danh-gia-landing.html`. Search, filtering, page changes, and product detail routes work locally. Account and submission forms display demonstration messages only; they do not authenticate, transmit, or persist data.
