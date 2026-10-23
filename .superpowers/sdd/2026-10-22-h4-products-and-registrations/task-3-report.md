# H4-C3 task report — admin product and registration editor

## Implementation

- Added `saveProductDraft` as a narrow owner/admin workflow helper. It validates every selected file before writes, counts saved plus selected attachments against the 20-file limit, creates/updates once, uploads sequentially, and does not retry automatically. Editing merges the full existing `formData` before submitting a single-field change.
- Added real owner/admin command hooks and the admin products API surface for list, detail, mutations, private attachments and results. Manager create includes `registrantId` and `reason`; manager edits and file/status actions include the reason.
- Added server-paged product and registration lists with server metadata, filters, owner search via `registrantQ`, locality lookup, and shared detail tabs. `/admin/products/$id` and `/admin/registrations/$id` reuse the admin detail page and results page; the detail parent renders its nested outlet.
- Added the shared owner/admin draft editor and preserved owner routes. MANAGE guards new/edit routes; VIEW guards list/detail. The owner selector query is disabled outside a manager new-registration flow and requests active, verified registrants through the server. VIEW sees no draft edit/create controls.
- Kept retired category/locality choices visible and disabled with a warning, kept contact address separate from locality, and allowed a draft without locality while preventing submission without an active locality.
- Private thumbnails and file links use authorized Blob APIs and object URLs. Object URLs are revoked on cleanup; public attachment URLs are not used for draft/evidence.
- Session query cache now clears when user ID, access token or staff permissions change, and remains on name-only updates.

## Verification

| Check | Result |
|---|---|
| `pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-draft-save.test.ts ../web/test/session-contract.test.ts ../web/test/product-editor-categories.test.ts` | Passed: 18 tests. |
| `pnpm --filter @ocop/web typecheck` | Passed. |
| Web API boundary check | Passed. |
| Web API integration/file contract check | Passed. |
| Web proxy check | Passed. |
| `pnpm --filter @ocop/web build` | Passed. |
| `git diff --check` | Passed, with standard Windows line-ending notices only. |

## Limitations

Browser acceptance was not run. The C3 task explicitly prohibited database access, seed operations and database writes; no populated API fixture was available that could exercise the required owner/admin permission, upload-failure and snapshot flows safely. PostgreSQL tests were not run and no DB connection was attempted. No BE implementation was changed for C3.
