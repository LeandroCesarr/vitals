## Context

The repository is currently empty except for `.gitignore`, `LICENSE`, and the OpenSpec
planning scaffold itself — no `package.json`, no apps, no tooling config. This is the first
change in the project, so every technical decision here becomes the baseline every later
change (`domain-core`, `github-provider`, `persistence`, `pr-sync`, `structural-metrics`,
`metrics-api`, `google-oauth-auth`, `dashboard-ui`) builds on.

Because the project is in its internal/test/experimentation phase (per `openspec/config.yaml`),
adopting a preview/next-tag dependency is explicitly permitted as long as it's recorded here
with a re-evaluation trigger.

## Goals / Non-Goals

**Goals:**
- Stand up a pnpm + Turborepo 2.x monorepo that runs, lints, type-checks, and builds cleanly
  from a fresh clone with a single `pnpm install`.
- Get `apps/api` (NestJS `@next/v12`, ESM) and `apps/dashboard` (Next.js App Router) each
  running with zero business logic — just the framework defaults.
- Pre-structure `packages/shared-types` so later changes can add shared DTOs without
  re-plumbing workspace wiring.
- Get CI (lint + type-check + build) enforced as required PR checks from day one, so every
  subsequent change lands on a green baseline.
- Establish the TS version split (api on 6.0.x, dashboard on 7.x) at the shared
  `@vitals/tsconfig` level so later changes don't have to renegotiate it.

**Non-Goals:**
- No `domain/` entities, ports, or services (that's `domain-core`).
- No VCS provider adapter, no Octokit, no GitHub API calls (`github-provider`).
- No Prisma schema or database wiring (`persistence`).
- No auth (`google-oauth-auth`), no custom dashboard UI beyond the starter home page
  (`dashboard-ui`).
- No test suite — there is no business logic yet to justify TDD infrastructure, and CI's
  required checks are limited to lint/type-check/build per the proposal. `nest-cli`'s
  `@next` (v12) generator already defaults to Vitest (not Jest), so its default test
  tooling is kept as-is (see decision #9) rather than stripped; no spec files are added.

## Decisions

### 1. pnpm workspaces + Turborepo 2.x task graph
`pnpm-workspace.yaml` declares `apps/*` and `packages/*`. `turbo.json` uses the Turborepo 2.x
`tasks` key (not the deprecated 1.x `pipeline` key), with five tasks defined at the root:
`lint`, `format`, `format:check`, `type-check`, `build`. Each app/package declares matching scripts in its own
`package.json`; Turborepo just orchestrates + caches. `build` depends on `^build` (any future
workspace package with a real `build` step runs before the apps that consume it;
`packages/shared-types` has no `build` script — see decision #5 — so Turborepo skips it in
this task without breaking the graph).

Node.js version is pinned via a root `.nvmrc` (`22.23.1`, current 22.x LTS) plus an
`engines.node: ">=22.18.0"` field in the root `package.json`. CI's `actions/setup-node`
reads `node-version-file: '.nvmrc'` instead of a hardcoded version, so local dev and CI can
never drift apart. The `>=22.18.0` floor (not just `>=22.0.0`) is required, not a rounding
choice: `oxfmt.config.ts` files (decision #6) are loaded via Node's native TypeScript
support, which requires Node `^20.19.0 || >=22.18.0` — confirmed empirically when
`oxfmt -c oxfmt.config.ts` failed under the originally-planned Node 22.15.0 with "TypeScript
config files require Node.js ^20.19.0 || >=22.18.0."

**Alternative considered**: Nx. Rejected — `openspec/config.yaml` already pins Turborepo 2.x
as the project's stack; no reason to deviate on this change.

### 2. `apps/api` on NestJS `@next/v12` (preview), ESM
Scaffolded with `@nestjs/cli@next` against the `@next` preview tag, configured for ESM
(`"type": "module"` in `apps/api/package.json`, `nest-cli.json` / `tsconfig` set for
`NodeNext` module resolution). Ships with only the default `AppModule` — no additional
modules, controllers beyond the generator default, or providers.

**Preview tooling flag** (per `openspec/config.yaml` rule to record stack deviations):
- **Package**: `@nestjs/core@next`, `@nestjs/common@next`, `@nestjs/cli@next` (v12 preview
  line), adopted 2026-07-26.
- **Reason**: v12 is the first NestJS line with native ESM support and Standard Schema
  (zod) validation, both required by the project's stack decisions in
  `openspec/config.yaml`. Stable v11 doesn't offer these.
- **Re-evaluation trigger**: re-evaluate this pin when NestJS v12 reaches stable GA, or
  sooner if the preview tag ships a breaking change that blocks this change's CI. Track via
  a follow-up OpenSpec change (not a silent version bump) once v12 GAs.

### 3. `apps/dashboard` on Next.js, App Router, stable channel
Scaffolded with `create-next-app` (App Router, TypeScript, no `src/` directory changes beyond
the generator default). No preview tag needed here — Next.js's stable channel already
supports everything this change requires (App Router, TS7 via
`experimental.useTypeScriptCli`).

### 4. Split TypeScript versions via per-app config, not a single root version
Shared compiler options (`strict: true`, etc.) live in `packages/tsconfig`
(`@vitals/tsconfig`, `base.json`) instead of a loose `tsconfig.json` at the repo root —
consistent with `oxlint-config`/`oxfmt-config` (decision #6): a real workspace package, not
a bare file, so it's versioned, dependency-tracked, and not mistaken for "the root project's
own tsconfig." Every workspace member depends on it (`workspace:*`, dev-only) and points its
own `tsconfig.json` at `"extends": "@vitals/tsconfig/base.json"` — TypeScript's `extends`
natively resolves package names through `node_modules` (confirmed empirically: pointing it
at a deliberately wrong subpath fails with `TS6053: File not found`, proving it's a real
resolution, not a silent no-op). No path alias for `@vitals/shared-types` is needed either,
since it resolves through normal `node_modules` package resolution (pnpm symlinks the
workspace package, and its own `package.json` points `types` directly at its source; see
decision #5). Each app additionally pins its own TypeScript range in its own `package.json`
devDependency:
- `apps/api`: `typescript@~6.0.0` — pinned because `nest-cli` (even on `@next`) doesn't yet
  support the TS7 compiler pipeline.
- `apps/dashboard`: `typescript@^7.0.0`, with `next.config.ts`'s
  `experimental.useTypeScriptCli: true` enabled to opt into the TS7 CLI.
- `packages/shared-types`: pinned to `~6.0.0` for its own `type-check` script. Since the
  package only ever exports type-only declarations (interfaces/type aliases, no runtime
  code) and both apps consume it via `import type` (fully erased at compile time, never
  bundled), the TS6/TS7 split doesn't create a compatibility gap here — plain
  interface/type-alias syntax is stable across both compiler versions. Revisit only if this
  package needs TS7-only type-level syntax that TS6 can't parse.

**Alternative considered**: one TS version for the whole monorepo. Rejected — explicitly
disallowed by `openspec/config.yaml` (`apps/api` fixed at 6.0.x, `apps/dashboard` allowed
7.x), because `nest-cli` doesn't support TS7 yet.

### 5. `packages/shared-types` as an empty, pre-wired, source-only package
Minimal `package.json` (name `@vitals/shared-types`, no `main` — there is no runtime code —
just `types` pointing directly at `src/index.ts`), a `tsconfig.json` extending root (used
only by its own `type-check` script; no `build`, `composite`, or `references`), and a single
`src/index.ts` exporting nothing (`export {}`) so the package is a valid, importable,
type-checkable no-op. Both apps add it as a workspace dependency (`workspace:*`) even though
nothing imports from it yet, so the dependency wiring is proven by CI before any real DTO
lands.

Consumption is source-only and type-only: apps import with
`import type { ... } from '@vitals/shared-types'`, which TypeScript fully erases at compile
time — there is no runtime module to bundle or transpile, so no build step, `dist` output, or
TS project references are needed. This holds as long as the package only ever exports types
(interfaces/type aliases), which is the intended and enforced use for this package (DTOs,
not runtime helpers). If a later change needs to export runtime code (e.g., shared constants
or validators) from this package, that's the trigger to revisit this decision and add a real
build step then.

### 6. oxlint + oxfmt via shared TS config packages, per-package scripts, no ESLint/Prettier
Two internal, unpublished workspace packages hold the shared configuration, both following
the same shape: a TypeScript module with a typed default export, consumed through each
tool's native `defineConfig()` JS/TS config format (not a static JSON file):

- `packages/oxlint-config` (`@vitals/oxlint-config`): `index.ts` default-exports an
  `OxlintConfig` object (plugins, categories, rules, env). Every workspace member has its
  own `oxlint.config.ts`:
  ```ts
  import { defineConfig } from "oxlint";
  import base from "@vitals/oxlint-config";

  export default defineConfig({ extends: [base] });
  ```
  oxlint's JS/TS config format requires `extends` entries to be actual imported config
  *objects*, not path strings (confirmed empirically — passing a string there is a hard
  config-load error: `` `extends[0]` must be a config object (strings/paths are not
  supported) ``; this differs from the plain-JSON `.oxlintrc.json` format, where `extends`
  takes file paths). `oxlint.config.ts` is auto-discovered per package with no `-c` flag.
- `packages/oxfmt-config` (`@vitals/oxfmt-config`): `index.ts` default-exports an
  `OxfmtConfig` object. Every workspace member has its own `oxfmt.config.ts`:
  ```ts
  import { defineConfig } from "oxfmt";
  import base from "@vitals/oxfmt-config";

  export default defineConfig({ ...base });
  ```
  Unlike oxlint, oxfmt's config schema has no `extends` field at all (confirmed against
  `node_modules/oxfmt/configuration_schema.json`, and empirically: an `extends` array is
  silently ignored, no error, no effect — a `semi: false` test only took effect once spread
  directly into the object). `defineConfig()` is just a typed identity function per oxfmt's
  own `.d.ts`; it does not merge `extends`. Plain object spread achieves the same practical
  result without pretending oxfmt supports something it doesn't. `oxfmt.config.ts` is also
  auto-discovered per package with no `-c` flag (confirmed empirically).

Both config packages self-apply their own tool via the exact same import pattern every
consumer uses — `import base from "@vitals/oxlint-config"` / `"@vitals/oxfmt-config"` — not
a relative `./index.ts` import. This relies on Node's (and TypeScript's `NodeNext`
resolution's) built-in **self-referencing packages** feature: a package can import its own
`name` and have it resolve through its own `exports` field, with no dependency entry on
itself and no `node_modules` symlink needed. Confirmed working at both type-check (`tsc
--noEmit`) and runtime (`oxlint`/`oxfmt` actually loading the config). The alternative — a
relative `./index.ts` import — technically works too, but requires the non-default
`allowImportingTsExtensions` compiler option and is asymmetric with every other consumer;
rejected in favor of the simpler, consistent self-reference form.

`packages/oxlint-config` and `packages/oxfmt-config` **do not** depend on each other. An
earlier version had each one self-apply the *other* tool (oxfmt-config linting itself via
`@vitals/oxlint-config`, and vice versa), which created a cyclic workspace dependency
(`pnpm install` warned: "There are cyclic workspace dependencies"). Fixed by having each
package only use its own tool on itself — `oxlint-config` only lints itself, `oxfmt-config`
only formats itself — since neither actually needs the other's tool for its own two-file
scope.

This TS-config approach required bumping the Node.js floor to `>=22.18.0` (decision #1),
since both tools load `.ts` config files via Node's own native TypeScript support, which has
that minimum.

**Alternative considered (1)**: a single root config file with no per-package scripts.
Rejected per explicit user preference for each package/app to own its own lint/format step,
matching the common Turborepo pattern of a shared `*-config` package extended by every
workspace member (mirrors how `eslint-config-custom` packages work in the standard Turborepo
examples, adapted to oxlint/oxfmt).

**Alternative considered (2)**: reference the shared config via static JSON files (a plain
`base.json` per tool) and an explicit `-c node_modules/@vitals/<tool>-config/base.json` flag
on every script. This was the first implementation for both tools and it worked, but it
doesn't match the TS `defineConfig`/`extends` composition pattern already used in this org's
other projects (a real example — `oxfmt.config.ts` importing a shared `@bullhub/fmt` base —
was reviewed during implementation and used as the reference), and a plain `-c` flag is not
picked up by editor/LSP tooling the way an auto-discovered `*.config.ts` is. Replaced with
the TS-module approach above for both tools.

No ESLint or Prettier config, dependency, or file exists anywhere in the repository — oxlint
and oxfmt are the sole lint/format tools.

**Preview tooling flag (2)** (per `openspec/config.yaml` rule to record stack deviations):
- **Package**: `oxfmt` (oxc's formatter), adopted 2026-07-26.
- **Reason**: user preference to standardize on the full oxc toolchain (oxlint + oxfmt)
  instead of mixing oxlint with Prettier. This reverses `openspec/config.yaml`'s documented
  rationale for Prettier ("oxfmt still unstable").
- **Re-evaluation trigger**: re-evaluate this choice if `oxfmt` produces incorrect/unstable
  formatting output, breaks CI, or lacks a feature the project needs before it reaches a
  stable release. If any of those happen, fall back to Prettier via a follow-up OpenSpec
  change (not a silent swap).

### 7. CI: three required jobs, no test job
`.github/workflows/ci.yml` triggers on `pull_request`. Three jobs — `lint`, `type-check`,
`build` — run in parallel, each: checkout → setup pnpm (via `pnpm/action-setup`) → setup
Node → `pnpm install --frozen-lockfile` → `turbo run <task> --filter=...` scoped to changed
packages where useful, but for this change (small monorepo) running unscoped is acceptable.
All three are configured as required status checks on the default branch's protection rule
(a manual GitHub repo-settings step, called out in tasks.md since it can't be expressed in
YAML). No `test` job — there is no business logic yet, and the proposal explicitly scopes
tests out of this change's CI.

### 8. Versioning: tag `v0.1.0` on merge
No CI automation for tagging in this change (that's a later concern once releases are more
frequent) — the merge commit is tagged manually (`git tag v0.1.0 && git push --tags`) as the
last task, per the project's SemVer convention (0.x.y during internal/test phase, MINOR for
first functional scaffolding).

### 9. Reconcile `nest-cli`'s `@next` generator defaults with project conventions
`nest new` on the `@next` (v12 preview) line turned out to already default to `"type":
"module"` (ESM), oxlint, and **Vitest** — not Jest as assumed when this design was first
written. That default already matches `openspec/config.yaml`'s stack decisions, so it is
kept as-is: `vitest.config.ts`/`vitest.config.e2e.ts` and the `vitest`/`@nestjs/testing`/
`supertest` devDependencies stay, scaffolded with `--skip-tests` so no `.spec.ts`/
`.e2e-spec.ts` files are added (no test suite is in scope for this change; Vitest is simply
not fighting the generator anymore). Real TDD wiring is still deferred to whichever future
change first needs it (most likely `domain-core`).

Two things from the generator's defaults still needed correcting:
- **Prettier**: the generator scaffolds `.prettierrc`, a `prettier` devDependency, and a
  `format` script calling `prettier --write`. Removed and replaced with `oxfmt` (decision
  #6) — the generator's Prettier choice predates this project's oxfmt decision and isn't a
  documented convention here.
- **Floating `@nestjs/*` version tag**: the generator pins `@nestjs/common`, `@nestjs/core`,
  `@nestjs/platform-express`, `@nestjs/cli`, `@nestjs/schematics`, and `@nestjs/testing` to
  the literal string `"next"` (a moving target). Repinned to the exact versions resolved at
  scaffold time (`12.0.0-alpha.5` / `.6` / `.9`), per the preview-tooling risk mitigation in
  this document (pin exact versions, not a floating range).
- **`incremental: true` + `deleteOutDir: true` conflict**: the generator's own
  `tsconfig.json` sets `"incremental": true` while `nest-cli.json` sets
  `"compilerOptions.deleteOutDir": true`. `deleteOutDir` wipes `dist/` on every build, but
  the incremental compiler's `.tsbuildinfo` bookkeeping doesn't know that happened — once a
  buildinfo file exists, a later build can conclude "nothing changed, nothing to emit" and
  leave `dist/` empty even though the command reports success. Reproduced directly (a clean
  build works; a second build, or one after an external buildinfo write, silently emits
  nothing) and fixed by removing `"incremental": true` — `deleteOutDir` already forces a full
  rebuild every time, so incremental caching had no benefit here and was actively harmful.
  `*.tsbuildinfo` was also added to `.gitignore` as a safety net.

`apps/api`'s own `tsconfig.json` also needed to `extend` the shared `@vitals/tsconfig` base
(it shipped as a disconnected `strict: false` config) and TypeScript 6.0's stricter
`rootDir` requirement (TS5011) meant `tsconfig.build.json` needed an explicit
`rootDir: "./src"` plus excludes for the Vitest and oxfmt/oxlint config files, so
`nest build` emits `dist/main.js` (matching the generator's own `start:prod` script) instead
of `dist/src/main.js`.

**Alternative considered**: strip the generator's Vitest scaffolding too, on the assumption
that "no test runner in scope" meant zero test tooling of any kind. Rejected once it became
clear the default is Vitest, not Jest — removing already-correct, already-aligned scaffolding
would just mean re-adding the same thing later for no benefit.

### Domain/architecture check (per config.yaml design rules)
This change touches no `domain/` code and introduces no framework/SDK dependency into a
`domain/services` layer, because that layer doesn't exist yet — `apps/api` ships with only
the default `AppModule`. No VCS provider is implemented or modified, so the
`VcsProviderPort` conformance rule doesn't apply here.

## Risks / Trade-offs

- **[Risk]** `openspec/config.yaml` requires "at least 1 human approval" on every PR, but
  this repository currently has a single collaborator (the owner) — a required-reviews rule
  would block every merge forever, since GitHub disallows self-approval. → **Mitigation**:
  the branch protection configured in this change (decision, section 9) enforces only the
  `Lint`/`Type-check`/`Build` status checks, with `required_pull_request_reviews` removed
  for now. This is a **documented, deliberate deviation** from the config.yaml convention,
  not an oversight — re-add `required_approving_review_count: 1` the moment a second
  collaborator joins the repository.
- **[Risk]** `@nestjs/*@next` (v12 preview) could ship a breaking change or be pulled/retagged
  between now and implementation. → **Mitigation**: pin exact preview versions (not `^next`
  floating) in `apps/api/package.json`; re-run `pnpm install` and CI before merge to catch
  drift; re-evaluation trigger documented above.
- **[Risk]** `oxfmt` is pre-stable (per `openspec/config.yaml`'s own documented caveat) and
  could produce inconsistent formatting, crash on valid TypeScript syntax, or change output
  behavior across patch releases. → **Mitigation**: pin an exact `oxfmt` version (not a
  floating range) across all workspace members via `packages/oxfmt-config`'s own
  devDependency; CI's `format:check` job catches drift before merge; re-evaluation trigger
  and Prettier fallback path documented in decision #6.
- **[Risk]** `oxfmt.config.ts` files require Node's native TypeScript support
  (`>=22.18.0`); a contributor or CI runner on an older Node 22.x would fail to run
  `format`/`format:check` with a version error. → **Mitigation**: `.nvmrc` pins `22.23.1`
  and root `engines.node` requires `>=22.18.0`; CI's `actions/setup-node` reads
  `node-version-file: '.nvmrc'` (decision #1), so this can't silently drift.
- **[Risk]** Splitting TS versions between `apps/api` (6.0.x) and `apps/dashboard`/`shared-types`
  policy could cause type incompatibilities once `shared-types` grows real DTOs consumed by
  a TS7-only dashboard feature. → **Mitigation**: keep `shared-types` on the more
  conservative TS6.0.x for now (decision #4); revisit in the change that first needs
  TS7-only syntax there.
- **[Risk]** Turborepo remote caching is not configured in this change (no Vercel remote
  cache token), so CI gets no cross-run cache benefit yet. → **Mitigation**: acceptable for
  a monorepo this small; local `turbo` cache still speeds up repeated local runs. Revisit if
  CI times become a problem.
- **[Risk]** Branch protection (required status checks) must be configured manually in GitHub
  repo settings — not expressible in this change's committed files. → **Mitigation**: called
  out explicitly as a task in `tasks.md` so it isn't silently skipped.
- **[Risk]** `pnpm-lock.yaml` is first generated against an empty workspace (task 1.6), before
  any app/package/dependency exists; if it isn't regenerated after scaffolding, CI's
  `pnpm install --frozen-lockfile` fails. → **Mitigation**: explicit task to regenerate and
  commit the lockfile after all packages are scaffolded, followed by a local
  `--frozen-lockfile` dry run before opening the PR (`tasks.md` section 7).

## Migration Plan

Not applicable — there is no prior release or existing data to migrate. This is the initial
scaffolding commit sequence on a fresh repository.

## Open Questions

- None blocking implementation. The one deferred decision (whether `shared-types` moves to
  TS7 once it holds real DTOs) is captured as a future re-evaluation point in Decision #4,
  not an open question for this change.
