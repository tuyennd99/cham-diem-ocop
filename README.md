# OCOP monorepo

- `apps/api`: NestJS + Prisma API.
- `apps/web`: React + Vite frontend; includes the original authored designs and assets.
- `packages/shared`: TypeScript API contracts shared by both apps. Import these with `import type`.

Use Node.js 24 (>=24.7) and pnpm 11.17.0. From the repository root:

```sh
pnpm install
pnpm dev
pnpm build
pnpm typecheck
```

Run an app independently with `pnpm --filter @ocop/api dev` or `pnpm --filter @ocop/web dev`.
API configuration belongs in `apps/api/.env`; copy `apps/api/.env.example` and supply local values.
Prisma commands run with `pnpm --filter @ocop/api prisma <command>`.
Database migration and seeding are explicit operations; the workspace setup does not execute them.

## Original repositories

Both original Git histories remain ancestors of the monorepo branch. Their refs are also retained under
`refs/archive/api/*` and `refs/archive/web/*`. Inspect them with `git log refs/archive/api/heads/feature/update-schema`
or `git log refs/archive/web/heads/main`. Historical paths retain their original layout.
The monorepo import uses the actual working files, including frontend files that had not yet been committed.
The original Git metadata (including reflogs and local configuration) is preserved locally in
`.git/legacy-repos/api.git` and `.git/legacy-repos/web.git`; these local archives are not transferred by a clone.
Generated files and local environment files remain on disk and are ignored.

The OCOP specification is in `2026-10-12-ocop-scoring-system-design.md`.
