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

Authenticated API requests use bearer access tokens stored for the current browser session in local storage. The API response contract is `{ statusCode, data, meta? }`, with errors shaped as `{ statusCode, message }`.

The product form's `formData` field is currently edited as JSON because the API exposes stored form data without a dynamic form-schema endpoint. Product search filters the currently loaded API page; the product listing API does not currently accept a search parameter.

No build or runtime verification is recorded in this README.
