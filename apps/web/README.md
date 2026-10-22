# OCOP web app

React, Vite, and TanStack Router frontend for the OCOP scoring monorepo. The product, authentication, judge, and admin screens use the API; the local design references and preview pages remain available for visual context.

## Run locally

From the repository root, install workspace dependencies with `pnpm install`, then start the web and API apps using the root development scripts. The Vite dev server proxies `/api` to `http://localhost:3030` by default; set `VITE_API_PROXY` to change that target. Set `VITE_API_URL` when the browser should call a different API base URL directly.

## Frontend API and constants convention

The OCOP frontend uses the shared Axios transport in `src/api/base-request.ts`. Domain functions in `src/api/` own endpoints and request serialization; pages and query hooks consume those functions. Shared endpoints, session keys, query keys, HTTP statuses and pagination defaults live in `src/constants/`. The previous fetch client in `src/lib/api.ts` and unrelated task/system API samples have been removed.

```text
src/
├── api/
│   ├── base-request.ts  # Shared Axios instance and HTTP handling
│   └── <domain>.ts      # Reusable endpoint functions for each OCOP domain
├── constants/          # Shared endpoints, query keys, status codes and other constants
├── queries/            # TanStack Query hooks calling the domain API functions
├── stores/             # Zustand client stores (e.g. session state)
└── pages/
    ├── public/         # One file per public screen
    ├── auth/           # One file per authentication screen + shared AuthFrame
    ├── account/        # One file per account screen
    ├── registrant/     # One file per registrant screen
    ├── judge/          # One file per judge screen
    ├── admin/          # One file per admin module screen
    └── errors/         # 403 / 404 screens
```

- Keep Axios configuration, the base URL, Bearer headers, response/error handling, multipart uploads and binary downloads in `src/api/base-request.ts`. Domain modules in `src/api/` reuse that instance and expose named operations, such as listing products or submitting an evaluation.
- Components and pages read server data through `src/queries/` hooks. Query functions and mutations call domain API functions from `src/api/`; UI code does not call Axios, `fetch`, `baseRequest` or the generic `lib/api.ts` client directly, and does not assemble endpoint URLs or HTTP options.
- Keep shared values in `src/constants/`: endpoint paths and URL builders in `api.ts`, query keys in `query-key.ts`, HTTP statuses in `http-status.ts`, auth keys in `auth.ts`, and general shared values in `consts.ts`. Reuse the relevant exports instead of repeating literals in pages, hooks or API modules. Values used only inside one module can stay there.
- Keep request/response types in `src/types/` and cross-app contracts in `packages/shared`; keep non-HTTP helpers in `src/lib/`. A public image URL builder can be used by `<img src>`; private attachments still go through an authorized API function.

## Connected flows

- Public product listing, category filtering, and product details
- Email registration with OTP verification, login, password reset, and account profile
- Registrant product drafts, editing, attachments, and submission
- Judge queue, evaluation scoring, save, and submit
- Admin judge accounts, category/criterion assignments, products, and results

Authenticated requests use Bearer tokens stored in localStorage under `ocop-session`. The session persists across browser restarts until cleared or rejected by the API. JSON responses use `{ statusCode, data, meta?, message? }`; errors use `{ statusCode, message, requestId? }`. File downloads return binary data.

The product registration form follows Mẫu 01 in three steps with named fields; the API validates required fields when a draft is submitted. Photos and evidence attachments are optional.

Product search sends `q` to the API and searches across the matching database records, with server-side pagination. `VITE_API_URL` controls the browser base URL; the dev proxy reads `VITE_API_PROXY` from process variables or Vite env files and defaults to `http://localhost:3030`.

API/constants migration checks and browser status: [verification report](../../docs/verification/2026-10-22-web-api-constants.md). The earlier FE–BE runtime blockers remain documented in the [integration report](../../docs/verification/2026-10-16-fe-be-integration.md).
