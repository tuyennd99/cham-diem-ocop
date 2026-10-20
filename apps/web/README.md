# OCOP web app

React, Vite, and TanStack Router frontend for the OCOP scoring monorepo. The product, authentication, judge, and admin screens use the API; the local design references and preview pages remain available for visual context.

## Run locally

From the repository root, install workspace dependencies with `pnpm install`, then start the web and API apps using the root development scripts. The Vite dev server proxies `/api` to `http://localhost:3030` by default; set `VITE_API_PROXY` to change that target. Set `VITE_API_URL` when the browser should call a different API base URL directly.

## Connected flows

- Public product listing, category filtering, and product details
- Email registration with OTP verification, login, password reset, and account profile
- Registrant product drafts, editing, attachments, and submission
- Judge queue, evaluation scoring, save, and submit
- Admin judge accounts, category/criterion assignments, products, and results

Authenticated requests use Bearer tokens stored in localStorage under `ocop-session`. The session persists across browser restarts until cleared or rejected by the API. JSON responses use `{ statusCode, data, meta?, message? }`; errors use `{ statusCode, message, requestId? }`. File downloads return binary data.

The product registration form follows Mẫu 01 in three steps with named fields; the API validates required fields when a draft is submitted. Photos and evidence attachments are optional.

Product search sends `q` to the API and searches across the matching database records, with server-side pagination. `VITE_API_URL` controls the browser base URL; the dev proxy reads `VITE_API_PROXY` from process variables or Vite env files and defaults to `http://localhost:3030`.

Verification results and runtime blockers: [FE–BE integration report](../../docs/verification/2026-10-16-fe-be-integration.md).
