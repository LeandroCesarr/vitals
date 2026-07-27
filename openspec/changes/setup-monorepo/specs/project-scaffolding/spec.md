## ADDED Requirements

### Requirement: Monorepo workspace structure
The system SHALL be organized as a single pnpm workspace containing `apps/api`,
`apps/dashboard`, and `packages/shared-types`, orchestrated by Turborepo 2.x using the
`tasks` configuration key (not the deprecated 1.x `pipeline` key).

#### Scenario: Fresh install resolves the whole workspace
- **GIVEN** a clean clone of the repository with no `node_modules`
- **WHEN** a developer runs `pnpm install` at the repo root
- **THEN** dependencies for `apps/api`, `apps/dashboard`, and `packages/shared-types` are
  installed and linked as workspace packages, with no errors

#### Scenario: CI installs with a frozen lockfile
- **GIVEN** the committed `pnpm-lock.yaml` reflects every workspace package and dependency
- **WHEN** CI runs `pnpm install --frozen-lockfile`
- **THEN** the install succeeds with no lockfile drift errors

#### Scenario: Turborepo recognizes all workspace tasks
- **GIVEN** the installed workspace
- **WHEN** a developer runs `pnpm turbo run build`
- **THEN** Turborepo resolves a task graph covering `apps/api`, `apps/dashboard`, and
  `packages/shared-types`, skipping `packages/shared-types` (it has no `build` script — it
  is source-only) while `apps/api` and `apps/dashboard` build successfully

### Requirement: `apps/api` runs empty on NestJS `@next/v12` (ESM)
The system SHALL provide a NestJS application at `apps/api`, built on the `@next/v12` preview
tag with ESM module resolution, containing only the framework-generated `AppModule` — no
business modules, controllers, or providers beyond the default generator output.

#### Scenario: API starts successfully with no business logic
- **GIVEN** `apps/api` has its dependencies installed
- **WHEN** a developer runs the app's start script
- **THEN** the NestJS application boots successfully using only the default `AppModule`,
  with no errors, and responds on its configured port

#### Scenario: API build succeeds under ESM
- **GIVEN** `apps/api`'s source uses ESM (`"type": "module"`, `NodeNext` module resolution)
- **WHEN** a developer runs `apps/api`'s build script
- **THEN** the TypeScript compiler emits valid ESM output with no module-resolution errors

#### Scenario: Generator defaults are reconciled with project tooling conventions
- **GIVEN** `apps/api` was scaffolded with `nest-cli`'s `@next` (v12) generator, which
  already defaults to Vitest and oxlint (aligned with the project's stack) but also to
  Prettier and a floating `next` version tag for `@nestjs/*` packages
- **WHEN** setup for this change is complete
- **THEN** `apps/api` has no Prettier config or dependency (oxfmt is the sole formatter),
  `@nestjs/*` packages are pinned to exact preview versions rather than the floating `next`
  tag, and the generator's default Vitest configuration remains in place with no
  `.spec.ts`/`.e2e-spec.ts` files added

### Requirement: `apps/dashboard` runs empty on Next.js App Router
The system SHALL provide a Next.js application at `apps/dashboard`, using the App Router,
containing only the framework's default starter home page — no custom routes, components,
or business UI.

#### Scenario: Dashboard starts and serves the default starter page
- **GIVEN** `apps/dashboard` has its dependencies installed
- **WHEN** a developer runs the app's dev or start script
- **THEN** the Next.js application boots successfully and serves the framework's default
  App Router home page with no custom application code

### Requirement: `packages/shared-types` is a valid, empty, consumable package
The system SHALL provide `packages/shared-types` as a source-only, type-only workspace
package with its own `package.json` and `tsconfig.json`, exporting no members yet, and
declared as a `workspace:*` dependency of both `apps/api` and `apps/dashboard`. The package
SHALL NOT require a build step — its `package.json` `types` field points directly at its
TypeScript source, consumed via type-only imports that are erased at compile time.

#### Scenario: Shared-types package type-checks and is importable with no exports
- **GIVEN** the workspace is installed
- **WHEN** a developer runs `packages/shared-types`'s type-check script and imports it via
  `import type` from `apps/api` or `apps/dashboard`
- **THEN** type-checking succeeds and the import resolves to an empty module, with no type
  errors and no build step required

### Requirement: Shared linting and formatting tooling via per-package config
The system SHALL provide shared oxlint and oxfmt base configuration through two internal
workspace packages (`packages/oxlint-config`, `packages/oxfmt-config`). Every workspace
member (`apps/api`, `apps/dashboard`, `packages/shared-types`) SHALL extend both and own its
own `lint`, `format`, and `format:check` scripts. No ESLint or Prettier configuration,
dependency, or file SHALL be present anywhere in the repository.

#### Scenario: Lint runs across the whole workspace via per-package scripts
- **GIVEN** each workspace member has its own oxlint config extending
  `@vitals/oxlint-config`
- **WHEN** a developer runs the repo-root `lint` script
- **THEN** Turborepo fans out to `apps/api`, `apps/dashboard`, and `packages/shared-types`'s
  own `lint` scripts, and all exit successfully on unmodified generator output

#### Scenario: Format check runs across the whole workspace via per-package scripts
- **GIVEN** each workspace member has its own oxfmt config extending
  `@vitals/oxfmt-config`
- **WHEN** a developer runs the repo-root `format:check` script
- **THEN** Turborepo fans out to each workspace member's own `format:check` script, oxfmt
  reports all files as already formatted, and no ESLint or Prettier config file is present
  anywhere in the repository

### Requirement: Split TypeScript versions by app
The system SHALL pin `apps/api` (and `packages/shared-types`) to TypeScript 6.0.x, and
SHALL allow `apps/dashboard` to use TypeScript 7.x via `experimental.useTypeScriptCli`,
each declared independently in the respective package's `package.json`.

#### Scenario: API type-checks under TypeScript 6.0.x
- **GIVEN** `apps/api`'s devDependency on `typescript@~6.0.0`
- **WHEN** a developer runs `apps/api`'s type-check script
- **THEN** type-checking completes successfully using the TypeScript 6.0.x compiler

#### Scenario: Dashboard type-checks under TypeScript 7.x
- **GIVEN** `apps/dashboard`'s devDependency on `typescript@^7.0.0` and
  `experimental.useTypeScriptCli: true` in its Next.js config
- **WHEN** a developer runs `apps/dashboard`'s type-check script
- **THEN** type-checking completes successfully using the TypeScript 7.x compiler

### Requirement: CI enforces lint, type-check, and build on every PR
The system SHALL run a GitHub Actions workflow on every pull request that executes lint,
type-check, and build as three separate jobs, each configured as a required status check
before merge. The workflow SHALL NOT include a test job in this change.

#### Scenario: PR triggers all three required checks
- **WHEN** a pull request is opened or updated against the default branch
- **THEN** the CI workflow runs `lint`, `type-check`, and `build` jobs, each reporting a
  pass/fail status on the PR

#### Scenario: A failing job blocks merge
- **GIVEN** a pull request where the `lint`, `type-check`, or `build` job fails
- **WHEN** the PR author attempts to merge
- **THEN** the merge is blocked by branch protection until the failing required check
  passes

### Requirement: Release tagging on merge
The system SHALL be tagged `v0.1.0` at the commit where this change merges into the default
branch, following the project's SemVer convention for the first functional scaffolding
release.

#### Scenario: Tag exists after merge
- **GIVEN** this change has merged into the default branch
- **WHEN** a developer runs `git tag --list "v0.1.0"`
- **THEN** the tag `v0.1.0` exists and points at the merge commit
