## Why

The project currently has no scaffolding at all: no monorepo structure, no apps, no shared
tooling. Every other planned change (`domain-core`, `github-provider`, `persistence`,
`pr-sync`, `structural-metrics`, `metrics-api`, `google-oauth-auth`, `dashboard-ui`) depends
on this foundation existing first. Tracked by GitHub issue #1.

## What Changes

- Initialize a pnpm workspace + Turborepo 2.x monorepo (`turbo.json` using `tasks`, the
  Turborepo 2.x key — not the deprecated `pipeline` key from 1.x).
- Add `apps/api`: a NestJS app on the `@next/v12` preview tag (ESM), running empty — default
  `AppModule` only, no business modules, no domain logic.
- Add `apps/dashboard`: a Next.js app (App Router), running empty — the framework's default
  starter home page only, no custom UI.
- Add `packages/shared-types`: an empty, pre-structured package (package.json, tsconfig,
  empty `src/index.ts`) ready to hold DTOs shared between `api` and `dashboard` in later
  changes.
- Add shared tooling: three internal config packages — `packages/oxlint-config`,
  `packages/oxfmt-config` (base oxlint/oxfmt configuration that each app/package extends
  and runs through its own `lint`/`format`/`format:check` scripts) and `packages/tsconfig`
  (base TypeScript compiler options each app/package extends), with `apps/api` pinned to
  TypeScript 6.0.x (nest-cli doesn't support TS7 yet) and `apps/dashboard` allowed to use
  TypeScript 7.x via
  `experimental.useTypeScriptCli`.
- Add a basic CI workflow (GitHub Actions) that runs lint + type-check + build as required
  checks on every PR. Tests are explicitly out of scope for this CI workflow since there is
  no business logic yet to test.
- On merge, tag the resulting commit `v0.1.0` per the project's SemVer convention (first
  scaffolding release).

**Preview tooling flag (1):** `apps/api` adopts NestJS's `@next/v12` preview tag instead of
the current stable release. This is an intentional stack deviation permitted during the
project's test/experimentation phase (per `openspec/config.yaml`). It must be recorded in
`design.md` with a re-evaluation trigger (e.g., re-evaluate on NestJS v12 stable GA, or if
the preview tag introduces a breaking change before then).

**Preview tooling flag (2):** the project adopts `oxfmt` (oxc's formatter) instead of
Prettier, reversing `openspec/config.yaml`'s documented choice of Prettier "since oxfmt is
still unstable." This is a deliberate stack deviation for this change, permitted during the
project's test/experimentation phase. It must be recorded in `design.md` with a
re-evaluation trigger.

## Capabilities

### New Capabilities
- `project-scaffolding`: the monorepo's structural contract — workspace/package layout,
  the apps starting in an empty-but-running state, shared tooling configuration, and CI
  enforcing lint/type-check/build as required PR checks.

### Modified Capabilities
- None. There are no existing specs in `openspec/specs/` yet; this is the first change in
  the project.

## Impact

- **New code/config**: root `package.json`, `.nvmrc`, `pnpm-workspace.yaml`, `turbo.json`,
  `.github/workflows/ci.yml`, `apps/api/**` (NestJS `@next/v12` skeleton, own lint/format
  config), `apps/dashboard/**` (Next.js App Router skeleton, own lint/format config),
  `packages/shared-types/**` (empty, source-only package, own lint/format config),
  `packages/oxlint-config/**` (shared oxlint base config), `packages/oxfmt-config/**`
  (shared oxfmt base config), `packages/tsconfig/**` (shared TypeScript compiler options).
- **Dependencies introduced**: pnpm, Turborepo 2.x, NestJS `@next/v12` (ESM), Next.js,
  oxlint, oxfmt, TypeScript 6.0.x (api) / TypeScript 7.x (dashboard).
- **VCS integration**: none. This change does not touch any `VcsProviderPort` — no GitHub API
  calls, no `github/` feature module. That is scoped to the separate `github-provider`
  change.
- **Out of scope**: any business logic, database schema, VCS provider integration,
  authentication, or UI beyond each framework's default starter output. No `domain/` code,
  no Prisma schema, no `google-oauth-auth` work — all deferred to their own changes.
- **Expected SemVer bump**: **MINOR (0.1.0)**. This is the first functional scaffolding —
  there is no prior release (`0.0.x` or otherwise) to break, and per `openspec/config.yaml`
  the project stays on `0.x.y` during its internal/test phase, where a MINOR bump signals
  new backward-compatible functionality (here: the monorepo existing and building at all).