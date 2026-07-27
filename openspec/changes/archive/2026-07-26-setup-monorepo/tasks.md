## 1. Workspace root setup

- [x] 1.1 Create root `package.json` (private, `packageManager` pinned to the pnpm version
      in use, `engines.node` set to `>=22.18.0` — bumped from the initially planned
      `>=22.0.0` once `oxfmt.config.ts` (section 5/6) turned out to require Node's native
      TS support, root scripts: `lint`, `format`, `format:check`, `type-check`, `build`)
- [x] 1.2 Create root `.nvmrc` with `22.23.1` (current 22.x LTS satisfying the `>=22.18.0`
      floor) — installed via `nvm install 22.23.1` and set as the local default
- [x] 1.3 Create `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
- [x] 1.4 Create `turbo.json` using the Turborepo 2.x `tasks` key with `lint`, `format`,
      `format:check`, `type-check`, `build` tasks; `build` depends on `^build`
- [x] 1.5 ~~Create root `tsconfig.json`~~ — superseded: shared compiler options
      (`strict: true`, etc.) live in `packages/tsconfig` (`@vitals/tsconfig`) instead of a
      loose root file, consistent with `oxlint-config`/`oxfmt-config` (see section 5, task
      5.3). No path alias needed for `@vitals/shared-types` either — it resolves via normal
      workspace `node_modules` resolution
- [x] 1.6 Run `pnpm install` at the repo root and confirm it completes with no packages
      registered yet (sanity check before scaffolding apps)

## 2. `packages/shared-types`

- [x] 2.1 Create `packages/shared-types/package.json` (name `@vitals/shared-types`,
      `typescript@~6.0.0` devDependency, `types` field pointing directly at
      `src/index.ts`, no `main` field, only a `type-check` script — no `build` script,
      since this package is source-only and type-only)
- [x] 2.2 Create `packages/shared-types/tsconfig.json` extending the root config
- [x] 2.3 Create `packages/shared-types/src/index.ts` with `export {}` as a valid no-op
      module
- [x] 2.4 Run `pnpm --filter @vitals/shared-types type-check` and confirm it succeeds

## 3. `apps/api` (NestJS `@next/v12`, ESM)

- [x] 3.1 Scaffold `apps/api` with `@nestjs/cli@next` (v12 preview line), confirming the
      generated app only has the default `AppModule` (scaffolded with `--skip-tests
      --skip-git --skip-install`; the v12 preview generator already defaults to ESM,
      oxlint, and Vitest — see design decision #9 correction)
- [x] 3.2 Configure `apps/api` for ESM: `"type": "module"` in `package.json` (generator
      default), `NodeNext` module/moduleResolution in `apps/api/tsconfig.json` (now
      `extends` the shared `@vitals/tsconfig/base.json` instead of a disconnected
      `strict: false` config);
      `tsconfig.build.json` needed an explicit `rootDir: "./src"` (TS 6.0 requires it,
      TS5011) and excludes for `vitest.config*.ts` so `nest build` emits `dist/main.js`
      instead of `dist/src/main.js`
- [x] 3.3 Pin `typescript@~6.0.0` as an explicit devDependency in `apps/api/package.json`
      (generator scaffolded `^6.0.2`, tightened to `~6.0.0`); also pinned `@nestjs/*`
      packages to their exact resolved preview versions (`12.0.0-alpha.5`/`.6`/`.9`)
      instead of the generator's floating `"next"` tag, per the risk mitigation in
      design.md
- [x] 3.4 Add `packages/shared-types` as a `workspace:*` dependency of `apps/api` (unused
      import not required — dependency wiring only)
- [x] 3.5 Remove any generator-created business modules/controllers/providers beyond the
      default `AppModule`/`AppController`/`AppService`, per the "runs empty" requirement
      (confirmed — `--skip-tests` scaffold has no extras)
- [x] 3.6 Remove the generator's default Prettier setup from `apps/api`: deleted
      `.prettierrc`, removed the `prettier` devDependency, and rewrote the `format`/
      `format:check` scripts to use `oxfmt` (wiring to `@vitals/oxfmt-config` completes in
      section 6) — per design decision #9, the v12 preview's default Vitest scaffolding is
      kept as-is (already aligned with the project's stack), only Prettier and the
      floating NestJS version tag needed correcting
- [x] 3.6a Remove `"incremental": true` from `apps/api/tsconfig.json` — combined with
      `nest-cli.json`'s `deleteOutDir: true`, it caused `nest build` to report success but
      silently emit an empty `dist/` on a second/later build (the incremental `.tsbuildinfo`
      bookkeeping didn't know `deleteOutDir` had wiped the directory). Reproduced, fixed,
      and verified stable across 3 consecutive builds; added `*.tsbuildinfo` to
      `.gitignore` as a safety net
- [x] 3.7 Run `pnpm --filter api build` and confirm a clean ESM build
- [x] 3.8 Run `pnpm --filter api start` (or equivalent) and confirm the app boots and
      responds on its configured port with no errors (verified: boots clean, `GET /`
      returns HTTP 200)

## 4. `apps/dashboard` (Next.js App Router)

- [x] 4.1 Scaffold `apps/dashboard` with `create-next-app` (App Router, TypeScript, no
      custom `src/` reorganization); removed the generator's default `eslint.config.mjs`
      and `eslint`/`eslint-config-next` devDependencies (oxlint is the sole linter)
- [x] 4.2 Pin `typescript@^7.0.0` as an explicit devDependency in
      `apps/dashboard/package.json` (resolved to `7.0.2`); also added `extends:
      "../../tsconfig.json"` to `apps/dashboard/tsconfig.json` for consistency with
      `apps/api`, keeping Next-required overrides (`bundler` resolution, DOM lib, JSX,
      `noEmit`) on top
- [x] 4.3 Enable `experimental.useTypeScriptCli: true` in `apps/dashboard/next.config.ts`
      (confirmed against `node_modules/next/dist/docs` — Next 16 has real breaking changes
      from prior versions per its own `AGENTS.md`, so the option shape was verified rather
      than assumed); `next build` output confirms `✓ useTypeScriptCli` is active
- [x] 4.4 Add `packages/shared-types` as a `workspace:*` dependency of `apps/dashboard`
- [x] 4.5 Confirm no custom routes/components were added beyond the framework's default
      starter home page (only `app/page.tsx`, `app/layout.tsx`, `app/globals.css` —
      generator defaults)
- [x] 4.6 Run `pnpm --filter dashboard build` and confirm a clean build under TypeScript 7.x
- [x] 4.7 Run `pnpm --filter dashboard dev` (or `start`) and confirm the default starter
      page renders with no errors (verified via `next start`: `GET /` returns HTTP 200)

## 5. Shared config packages (oxlint, oxfmt, tsconfig)

- [x] 5.1 Create `packages/oxlint-config/package.json` (`@vitals/oxlint-config`,
      `"exports": "./index.ts"`) and `index.ts` default-exporting a typed `OxlintConfig`
      base object. Own `oxlint.config.ts` self-applies it via
      `import base from "@vitals/oxlint-config"` (Node/TS package self-reference — no
      relative import, no extra compiler flags)
- [x] 5.2 Create `packages/oxfmt-config/package.json` (`@vitals/oxfmt-config`,
      `"exports": "./index.ts"`, `oxfmt` pinned to exact `0.60.0` — not a floating range)
      and `index.ts` default-exporting a typed `OxfmtConfig` base object. Own
      `oxfmt.config.ts` self-applies it the same self-reference way
- [x] 5.3 Create `packages/tsconfig/package.json` (`@vitals/tsconfig`) and `base.json` with
      the shared compiler options (`strict: true`, `esModuleInterop`, `skipLibCheck`,
      `forceConsistentCasingInFileNames`, `resolveJsonModule`, `isolatedModules`,
      `noUncheckedIndexedAccess`) — a real workspace package, not a loose root file (see
      design decision #4)
- [x] 5.4 Add `@vitals/oxlint-config`, `@vitals/oxfmt-config`, and `@vitals/tsconfig` as
      `workspace:*` devDependencies of `apps/api`, `apps/dashboard`, `packages/shared-types`,
      and each other's sibling config packages where needed — but **not** `oxlint-config`
      and `oxfmt-config` of each other (an earlier attempt at each self-applying the *other*
      tool created a cyclic workspace dependency; each now only self-applies its own tool)

## 6. Per-package lint/format/type-check scripts

- [x] 6.1 Add `apps/api/oxlint.config.ts` (`defineConfig({ extends: [base] })`, base
      imported from `@vitals/oxlint-config`) and `apps/api/oxfmt.config.ts`
      (`defineConfig({ ...base })`, base imported from `@vitals/oxfmt-config` — plain
      spread, not `extends`, since oxfmt's config schema has no `extends` field). Both
      auto-discovered by their CLI with no `-c` flag. `oxlint --vitest-plugin` for its
      `lint` script (it already has Vitest), plain `oxfmt`/`oxfmt --check` for
      `format`/`format:check`, and a `type-check` script (`tsc --noEmit`) — removed the
      generator's own `oxlint.json` and `.prettierrc`
- [x] 6.2 Add `apps/dashboard/oxlint.config.ts` and `apps/dashboard/oxfmt.config.ts`
      following the same pattern; `oxlint --nextjs-plugin` for its `lint` script
- [x] 6.3 Add `packages/shared-types/oxlint.config.ts` and
      `packages/shared-types/oxfmt.config.ts` following the same pattern (it already has
      `type-check` from task 2.1)
- [x] 6.4 Wire root `package.json` scripts: `lint` → `turbo run lint`, `format` →
      `turbo run format`, `format:check` → `turbo run format:check` (no direct
      oxlint/oxfmt invocation at the root) — done as part of section 1
- [x] 6.5 Confirm no ESLint or Prettier config file, or `eslint*`/`prettier*` dependency,
      exists anywhere in the repo (verified via repo-wide search — none found)
- [x] 6.6 Set `"type": "module"` in `apps/dashboard`, `packages/shared-types`,
      `packages/oxlint-config`, and `packages/oxfmt-config`'s `package.json` (needed for
      Node to parse their `*.config.ts` files as ESM); add each config file to its
      package's `tsconfig.json` `include` (some had a narrow `include` that would have
      silently skipped type-checking the config file itself)
- [x] 6.7 Point every workspace member's `tsconfig.json` `extends` at
      `"@vitals/tsconfig/base.json"` (`apps/api`, `apps/dashboard`, `packages/shared-types`,
      `packages/oxlint-config`, `packages/oxfmt-config`), replacing the earlier
      `"../../tsconfig.json"` relative path now that shared compiler options live in
      `packages/tsconfig` (task 5.3) instead of a root file

## 7. Workspace-wide verification

- [x] 7.1 Run `pnpm install` at the repo root to regenerate `pnpm-lock.yaml` reflecting
      every package and dependency added in sections 2-6 (the lockfile from task 1.6 only
      covered the empty workspace) — up to date, resolves all 7 workspace projects (root +
      2 apps + 4 packages); lockfile ready to be committed with the rest of the change
- [x] 7.2 Run `pnpm install --frozen-lockfile` immediately after and confirm it succeeds
      with no lockfile changes — this is what CI will run, so it must pass locally first
      (confirmed: succeeds with no drift)
- [x] 7.3 Run `pnpm lint` and `pnpm format:check` from the repo root and confirm both pass
      against the unmodified generator output from sections 2-4, fanning out to each
      package's own script (confirmed: 4/4 packages pass both)
- [x] 7.4 Run `pnpm type-check` (Turborepo-orchestrated, hitting each app's own
      TypeScript version) from the repo root and confirm it passes for both `apps/api`
      (TS 6.0.x) and `apps/dashboard` (TS 7.x) (confirmed: 5/5 packages pass)
- [x] 7.5 Run `pnpm turbo run build` from the repo root and confirm `apps/api` and
      `apps/dashboard` build successfully, with Turborepo skipping `packages/shared-types`,
      `@vitals/oxlint-config`, `@vitals/oxfmt-config`, and `@vitals/tsconfig` (none have a
      `build` script — all source-only/type-only); also confirmed Turborepo's cache
      actually restores `dist/main.js` and `.next/BUILD_ID` on disk, not just replayed logs

## 8. CI (GitHub Actions)

- [x] 8.1 Create `.github/workflows/ci.yml` triggered on `pull_request`
- [x] 8.2 Add a `lint` job: checkout, `pnpm/action-setup`, `actions/setup-node` with
      `node-version-file: '.nvmrc'` (keeps CI and local dev on the same Node version),
      `pnpm install --frozen-lockfile`, `turbo run lint`
- [x] 8.3 Add a `type-check` job with the same setup, running `turbo run type-check`
- [x] 8.4 Add a `build` job with the same setup, running `turbo run build`
- [x] 8.5 Confirm the workflow has no `test` job (out of scope per proposal) — only `lint`,
      `type-check`, `build` jobs exist; YAML structure verified with a parser
- [x] 8.6 Open a draft PR to confirm all three jobs trigger and report status correctly.
      Deviated from "scratch branch, then discard" per user decision: committed the real
      work directly to `feature/1-setup-monorepo` (9 conventional-commit, English commits,
      no co-authorship trailer) and opened PR #10 against `main` as draft — genuinely
      useful work, not throwaway, so nothing to discard. All three checks passed on the
      first run: Build ✓, Lint ✓, Type-check ✓
      (https://github.com/LeandroCesarr/vitals/pull/10)

## 9. Branch protection (not expressible in committed files)

- [x] 9.1 Configure branch protection on `main` requiring the `Lint`, `Type-check`, and
      `Build` status checks (strict — branch must be up to date before merge) to pass
      before merge. Deviated from "manual, GitHub UI" per user decision: configured
      programmatically via `gh api repos/LeandroCesarr/vitals/branches/main/protection`
      (PUT), since the authenticated token has sufficient `repo` scope and the user owns
      the repository
- [x] 9.2 ~~Require at least 1 human approval on every PR~~ — attempted
      (`required_approving_review_count: 1`), but the repository has no collaborator other
      than the owner (`gh api repos/.../collaborators` returns only `LeandroCesarr`), so no
      one could ever approve and the rule blocked all merges outright (GitHub disallows
      self-approval). Removed `required_pull_request_reviews` per user decision, keeping
      only the `Lint`/`Type-check`/`Build` required status checks. This is a **documented
      deviation** from `openspec/config.yaml`'s "every PR requires at least 1 human
      approval" convention — re-add the review requirement once a second collaborator
      joins the repo. Force-push and branch deletion remain disabled either way

## 10. Finalize and release

- [x] 10.1 Update the OpenSpec change status (mark this change ready for archive once
      merged) — PR #10 merged into `main` (commit `da3213f`), all 49 tasks in this file
      done or explicitly deviated-and-documented; ready for `/opsx:archive`
- [x] 10.2 Open the PR for `setup-monorepo`, referencing this OpenSpec change and GitHub
      issue #1 — done as part of task 8.6: PR #10, merged
- [x] 10.3 After human approval and merge, tag the merge commit `v0.1.0` and push the tag
      (`git tag v0.1.0 && git push origin v0.1.0`) — tag pushed on merge commit `da3213f`
