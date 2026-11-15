# Progress

## 2026-11-15: Commit and push current workspace

Scope: commit all project changes and push the current `main` branch to
`origin/main`. Exclude `.scratch/`, which contains temporary browser profiles
and local verification artifacts. No production deployment or production
database migration is included.

Completion criteria: successful build, type checks, runnable startup checks,
relevant automated checks, independent review of sensitive changes, and remote
confirmation of the resulting commit. Record checks that remain incomplete.

### Baseline fixes

- Fixed the built SSR server's default client directory and prevented static
  access to its server bundle. Added `built-server.check.mjs`; it reproduced
  the original asset 404 before the fix and passes after the fix.
- Ran the existing web formatter to resolve the failing formatting baseline.
- With explicit user approval, updated stale session-role fixtures, file count
  and size expectations, auth export expectations, homepage login expectations,
  and the route count for `/my/settings`. Corrected the inactive SCORE assertion.
- Removed extra trailing blank lines reported by `git diff --check`.

### Verified

- `pnpm typecheck`: both workspace apps completed successfully.
- `pnpm build`: both workspace apps completed successfully, including web SSR.
- `pnpm --filter @ocop/web format:check`: `All matched files use Prettier code style!`
- `pnpm --filter @ocop/api test --runInBand`: independent reviewer ran it after
  the fixes; `26 suites, 200 tests passed`.
- `node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test apps/web/test/*.test.ts scripts/dev-cloud.test.mjs`:
  `77 tests passed, 0 failed`.
- `node apps/web/test/api-boundary.check.mjs`, `api-integration.check.mjs`,
  `router.check.mjs`, `proxy.check.mjs`, `home-ssr.check.mjs`,
  `catalog-ssr.check.mjs`, `product-detail-ssr.check.mjs`, and
  `seo-integration.check.mjs` (all under `apps/web/test/`): PASS.
- `node apps/web/test/built-server.check.mjs`: PASS. Independent reviewer also
  confirmed JS/CSS HTTP 200 and blocked `/server/*` variants.
- `pnpm --filter @ocop/api test:db --runTestsByPath test/product-code.db-spec.ts --testNamePattern 'migrates legacy products' --verbose`:
  `1 passed, 1 skipped` (the other test was outside the selected name).
- `pnpm --filter @ocop/api test:db --runTestsByPath test/registration-units.db-spec.ts --verbose`:
  `2 passed` in 46.162 seconds, using an isolated schema.
- `pnpm --filter @ocop/api start:prod` with `PORT=31303`: application started;
  `GET /api/system/health/live` returned HTTP 200 with `data.status: ok`.
  Stopped the temporary startup process afterward.
- Independent review covered authentication/OTP, permissions, migrations
  0019–0021, public result filtering, and SSR. Confirmed SSR blocker was fixed.

### Not verified

- Full `pnpm --filter @ocop/api test:db` run was interrupted after several
  minutes without a completed suite report. The focused DB checks above passed;
  the entire database suite still needs a completed run.
- Production migration, live Google/SMTP, and desktop/mobile visual checks
  were not performed. No release-readiness claim is made.

Next step: complete the full database suite before a production release.
