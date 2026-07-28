## 1. Value objects and entities

- [x] 1.0a Add a TS path alias `@/*` → `./src/*` in `apps/api/tsconfig.json`
      (`compilerOptions.paths`), used for every import within `domain/` (not just
      cross-folder ones) per user direction — `baseUrl` was tried first but TS 6.0
      deprecates it (`TS5101`) and errors without it (`TS5090`) unless the path targets are
      written relative (`"./src/*"`), which works with no `baseUrl` at all
- [x] 1.0b Add `tsc-alias` as a devDependency of `apps/api` and change its `build` script to
      `nest build && tsc-alias -p tsconfig.build.json` — `nest build` (plain `tsc`) does not
      rewrite path aliases in its output, so without this, `@/*` imports would remain
      literally in `dist/*.js` and fail to resolve at runtime. Confirmed with a throwaway
      value-import smoke test that the alias is correctly rewritten to a working relative
      path in `dist/`
- [x] 1.0c Add a matching `resolve.alias` (`@` → `./src`) to `apps/api/vitest.config.ts`, so
      the same `@/*`-aliased imports resolve when tests run directly against `.ts` source
      (no `dist/` involved — confirmed empirically by deleting `dist/` entirely and
      re-running a test)
- [x] 1.0d Create `apps/api/src/domain/enums/vcs-provider.enum.ts` (`VcsProvider` enum:
      `GITHUB = "github"` for now) — deviated from the original plain-`string`
      `Repository.vcsProvider` field per user direction, mid-implementation, to use an enum
      for closed-set identification instead
- [x] 1.0e Create `apps/api/src/domain/enums/pull-request-state.enum.ts`
      (`PullRequestState` enum: `OPEN`, `CLOSED`, `MERGED`) — same reasoning, applied to
      `PullRequest.state`
- [x] 1.1 Create `apps/api/src/domain/entities/author.entity.ts` (`Author` **class**:
      `name`) — deviated from the original `interface` plan per user direction: all value
      objects in `domain/entities/` are classes, matching the entities themselves, not a
      mix of interfaces and classes. File suffixed `.entity.ts` (also per user direction),
      matching the `.port.ts`/`.service.ts`/`.enum.ts` suffix convention already used
      elsewhere in this change
- [x] 1.2 Create `apps/api/src/domain/entities/repository.entity.ts` (`Repository` class:
      `vcsProvider: VcsProvider`, `fullName`)
- [x] 1.3 Create `apps/api/src/domain/entities/tag.entity.ts` (`Tag` class: `metric`,
      `level`)
- [x] 1.4 Create `apps/api/src/domain/entities/pull-request.entity.ts` (`PullRequest`
      class: `repository`, `number`, `title`, `author`, `state: PullRequestState`,
      `createdAt`, `updatedAt` — no framework decorators)
- [x] 1.5 Create `apps/api/src/domain/entities/review-comment.entity.ts` (`ReviewComment`
      class: `id`, `author`, `body`, `createdAt` — no framework decorators)
- [x] 1.6 Create `apps/api/src/domain/entities/health-score.entity.ts` (`HealthScore`
      class: `rawScore`, `health`, `rulesVersion` — no framework decorators)
- [x] 1.7 Add `@faker-js/faker` (`10.5.0`, exact — pinned per this project's preview/pin
      convention) as a devDependency of `apps/api`. Confirmed this is the actively
      maintained community fork (`github.com/faker-js/faker`), not the original `faker`
      package whose maintainer deliberately sabotaged it in Jan 2022 (unrelated, unscoped
      package, long deprecated) — checked before adding, since the name similarity is a
      legitimate supply-chain concern to rule out
- [x] 1.8 Create `apps/api/test/builders/builder.ts`: an abstract `Builder<T>` base class
      with an abstract `build(): T` and a concrete `buildMany(count: number): T[]` (calls
      `build()` `count` times) — the classic GoF/refactoring.guru Builder pattern, shared
      across every entity builder below
- [x] 1.9 Create one builder per entity in `apps/api/test/builders/`
      (`author.builder.ts`, `repository.builder.ts`, `tag.builder.ts`,
      `pull-request.builder.ts`, `review-comment.builder.ts`, `health-score.builder.ts`),
      each extending `Builder<T>`: private fields default to `@faker-js/faker`-generated
      values, fluent `with*(...)` setters (return `this`) override any field, `build()`
      assembles the real entity. `PullRequestBuilder`/`ReviewCommentBuilder` compose
      `AuthorBuilder`/`RepositoryBuilder` for their nested defaults. Verified with a
      throwaway smoke test: `build()`, `buildMany()`, fluent overrides, and nested-builder
      composition all work

## 2. Ports

- [x] 2.1 Create `apps/api/src/domain/ports/vcs-provider.port.ts`: `VCS_PROVIDER_PORT`
      (`Symbol`) and `VcsProviderPort` interface (`fetchPullRequest`,
      `fetchReviewComments`) — interface only, no implementation
- [x] 2.2 Create `apps/api/src/domain/ports/score-repository.port.ts`:
      `SCORE_REPOSITORY_PORT` (`Symbol`) and `ScoreRepositoryPort` interface (`save`) —
      interface only, no implementation

## 3. `TagParserService` (TDD — red, green, refactor per scenario)

- [x] 3.1 Write a failing test: parsing `<!-- metric: lint level=1 -->` returns
      `{ metric: "lint", level: 1 }` — confirmed red (module didn't exist)
- [x] 3.2 Implement the minimal structured-tag regex to make 3.1 pass — confirmed green
- [x] 3.3 Write a failing test: parsing `[sql:2]` returns `{ metric: "sql", level: 2 }` —
      confirmed red
- [x] 3.4 Implement the minimal bracket-tag regex to make 3.3 pass — confirmed green
- [x] 3.5 Write a failing test: a comment with both a structured tag and a bracket tag
      returns both
- [x] 3.6 Confirm 3.5 passes — it already did, no implementation change needed (both
      regexes already ran unconditionally over the full comment body)
- [x] 3.7 Write a failing test: a comment with no tag markup returns an empty array
- [x] 3.8 Confirm 3.7 passes (implement only if the current pass doesn't already handle
      it) — already passed, no change needed
- [x] 3.9 Write a failing test: `[Lint:1]` (mixed case) returns metric `lint` (lower-cased)
- [x] 3.10 Confirm 3.9 passes — already passed (`.toLowerCase()` was applied from the
      first implementation in 3.2), no change needed
- [x] 3.11 Refactor `TagParserService` for clarity now that all scenarios pass; confirm
      100% coverage of its decision paths (both regex branches, empty-result branch,
      normalization). Refactored twice per user direction, mid-implementation: first
      de-duplicated the two near-identical regex loops into a shared private
      `extractTags(commentBody, pattern)` helper; then further reshaped
      `STRUCTURED_TAG_PATTERN`/`BRACKET_TAG_PATTERN` into a named `TAG_PATTERNS: readonly
      RegExp[]` array (keeping the individual named constants, not anonymous entries) so a
      third tag format can be added later with one array entry instead of a new method.
      Coverage confirmed 100% (statements/branches/functions/lines) via
      `vitest run --coverage`; added `@vitest/coverage-v8` as a devDependency of `apps/api`
      (missing until now — `test:cov` had never actually been run)

## 4. `rules.json` and config loader

- [x] 4.1 ~~Add `js-yaml`~~ — not needed. Deviated per user question mid-implementation:
      switched from `rules.yaml`/`js-yaml` to `rules.json`/native `JSON.parse`, avoiding a
      dependency entirely (`resolveJsonModule` is already enabled via
      `@vitals/tsconfig/base.json`). `proposal.md`/`design.md` updated to match (see
      design.md decision #6)
- [x] 4.2 Create `apps/api/rules.json` with `"version": "v1"` and placeholder weights for
      `lint`, `sql`, `security` (explicitly documented as placeholder, real calibration is
      out of scope)
- [x] 4.3 Create `apps/api/src/domain/config/rules-config.ts`: a `RulesConfig` type
      (`version`, `weights: Readonly<Record<string, number>>`) and a `loadRulesConfig()`
      loader (`fs.readFileSync` + `JSON.parse`, no library). Resolves `rules.json`'s
      location as an **absolute path** via `join(import.meta.dirname,
      "../../../rules.json")` (per user direction — not a relative string, and not
      dependent on `process.cwd()`) — verified this same relative offset (3 levels up from
      `domain/config/` to the app root) works correctly both under Vitest (running against
      `src/`) and against the real compiled `dist/` output, since `src/` and `dist/` sit at
      the same depth relative to the app root. Pragmatic test only (confirms it parses the
      shipped file into the expected shape), not a full TDD cycle, since this is I/O
      plumbing, not a domain decision path

## 5. `ScoringEngineService` (TDD — red, green, refactor per scenario)

- [x] 5.0a Create `apps/api/test/builders/rules-config.builder.ts` (`RulesConfigBuilder`,
      same `Builder<RulesConfig>` pattern as the entity builders): `withVersion()`,
      `withWeights()`, faker-seeded defaults — added per user direction so
      `ScoringEngineService`'s tests build fixtures the same way every other domain test
      does, instead of hand-writing plain `RulesConfig` object literals
- [x] 5.0b Add a dedicated `@test/*` → `./test/*` path alias (`tsconfig.json`'s `paths`,
      `vitest.config.ts`'s `resolve.alias`), alongside the existing `@/*` → `src/*` — per
      user direction, so spec files under `src/domain/` can import
      `apps/api/test/builders/*` without relative (`../../../test/...`) paths, matching the
      "no relative imports" convention already applied to `@/*`. Dev-only, no `tsc-alias`
      rewrite needed (spec files never ship in `dist/`)
- [x] 5.1 Write a failing test: given weight `5` for `lint` and a tag `{lint, level 2}`,
      the score is `10` — confirmed red (module didn't exist)
- [x] 5.2 Implement the minimal `weight × level` calculation to make 5.1 pass — confirmed
      green
- [x] 5.3 Write a failing test: given weights for `lint` (5) and `sql` (15) and tags
      `{lint, 1}` + `{sql, 1}`, the total score is `20`
- [x] 5.4 Implement/refactor summing across tags to make 5.3 pass — already passed, no
      change needed (the initial `reduce` already summed across all tags)
- [x] 5.5 Write a failing test: a tag with a metric absent from `weights` contributes `0`
      and does not throw
- [x] 5.6 Implement the lenient lookup (default to `0` for unknown metrics) to make 5.5
      pass — already passed, no change needed (`?? 0` was in the initial implementation)
- [x] 5.7 Write a failing test: the result's `rulesVersion` matches the injected rules
      configuration's `version`
- [x] 5.8 Implement/refactor to attach `rulesVersion` to the result, making 5.7 pass —
      already passed, no change needed
- [x] 5.9 Write a failing test: an empty tag list yields raw score `0`, with `rulesVersion`
      still present in the result
- [x] 5.10 Implement/refactor so the empty-list case is handled explicitly (not just
      incidentally by a `reduce` default), making 5.9 pass — already passed, no change
      needed (`reduce` with a `0` initial value on an empty array already returns `0`,
      and `rulesVersion` is attached unconditionally in the return statement)
- [x] 5.11 Refactor `ScoringEngineService` for clarity; confirm 100% coverage of its
      decision paths (recognized metric, unrecognized metric, empty tag list,
      `rulesVersion` propagation). Extracted a private `scoreTag(tag)` helper out of the
      `reduce` callback for readability. Coverage confirmed 100% via `vitest run --coverage`
      (the file doesn't even appear as an individual row in the default v8 text reporter
      once every metric hits 100%, same behavior observed for `TagParserService` in group 3)

## 6. `HealthCalculatorService` (TDD — red, green, refactor per scenario)

- [x] 6.1 Write a failing test: raw score `30` yields health `70` — confirmed red (module
      didn't exist)
- [x] 6.2 Implement the minimal `100 - rawScore` calculation to make 6.1 pass — confirmed
      green
- [x] 6.3 Write a failing test: raw score `150` yields health `0` (not negative) —
      confirmed red (`100 - 150 = -50`)
- [x] 6.4 Implement the `Math.max(0, ...)` floor to make 6.3 pass — confirmed green
- [x] 6.5 Write a failing test: raw score `0` yields health `100`
- [x] 6.6 Confirm 6.5 passes; refactor `HealthCalculatorService` for clarity; confirm 100%
      coverage of its decision paths (below-max, floored-at-zero, at-max) — already passed,
      no implementation change needed (`Math.max(0, 100 - 0)` already evaluates to `100`).
      No refactor needed either — the service is a single one-line pure function. Coverage
      confirmed 100% via `vitest run --coverage`

## 7. Domain module wiring

- [x] 7.1 Create the `RULES_CONFIG` token (`Symbol`) and register a factory provider in
      `domain.module.ts` that calls `loadRulesConfig()` once at module init — token colocated
      in `rules-config.ts` alongside `RulesConfig`/`loadRulesConfig()` (deviation from
      design.md decision #6's original inline-in-`domain.module.ts` sample), matching the
      port-token colocation pattern already used for `VCS_PROVIDER_PORT`/
      `SCORE_REPOSITORY_PORT`
- [x] 7.2 Create `apps/api/src/domain/domain.module.ts`: register `TagParserService`,
      `ScoringEngineService` (injecting `RULES_CONFIG`), `HealthCalculatorService` as
      providers; export all three
- [x] 7.3 Write a pragmatic test (NestJS `Test.createTestingModule`) confirming
      `DomainModule` resolves and all three services are injectable from it — not a TDD
      cycle, this is module-wiring plumbing, not a domain decision path

## 8. Verification

- [x] 8.1 Write an integration ("pipeline") test that chains the three real services
      together — a sample comment body through `TagParserService.parse()`, its output
      through `ScoringEngineService.score()`, that result's `rawScore` through
      `HealthCalculatorService.calculate()`, then constructs a real `HealthScore` from the
      combined results — asserting the final `rawScore`/`health`/`rulesVersion` match what
      hand-computing the example predicts. No mocking between services (all three are
      pure); this is the only place in the change that proves the three services'
      input/output shapes actually compose, since each service's own unit tests
      (sections 3, 5, 6) only exercise it with hand-written fixtures, never another
      service's real output. Placed at
      `apps/api/test/integration/domain-pipeline.integration.spec.ts` (`.integration.spec.ts`
      suffix, dedicated `test/integration/` directory) rather than next to a service's own
      `*.spec.ts` — per user direction, to keep integration tests visibly separate from unit
      specs (see design.md decision #5)
- [x] 8.2 Run `pnpm --filter api test:cov` and confirm 100% coverage of decision paths in
      `TagParserService`, `ScoringEngineService`, `HealthCalculatorService` — confirmed (none
      of the three appear as an individual row in the v8 text reporter, meaning all metrics
      hit 100%; the only remaining gap is `test/builders/builder.ts`'s `buildMany`, test
      infrastructure, not a domain decision path)
- [x] 8.3 Run `pnpm lint`, `pnpm type-check`, and `pnpm turbo run build` from the repo root
      and confirm the whole workspace stays clean — all three passed with 0 errors/warnings
      across every package. Also verified by inspecting `dist/domain/**/*.js` that `tsc-alias`
      correctly rewrote every `@/*` import in the newly built files (`domain.module.js`,
      `scoring-engine.service.js`) — no leftover unresolved `@/domain/...` specifiers
- [x] 8.4 Confirm (by inspection or `grep`) that no file under `apps/api/src/domain/`
      imports Octokit, Prisma, or any other VCS/persistence SDK — only `@nestjs/common`
      (for `@Injectable`/`@Inject`) and Node's built-in `node:fs`/`node:path` (in
      `rules-config.ts`'s loader, not the services). Corrected from the original wording,
      which still referenced `js-yaml` — stale from before the JSON pivot (section 4);
      `js-yaml` was never added. Confirmed via `grep` across every `import` in
      `src/domain/`: production files import only the above, spec files additionally
      import `vitest`/`@nestjs/testing`/`@test/builders/*` (test-only)
- [x] 8.5 Run `pnpm --filter api format:check` and confirm no formatting drift — found one
      drifted file (`test/integration/domain-pipeline.integration.spec.ts`), fixed by running
      `oxfmt` (not `--check`); re-ran `format:check` clean afterward

## 9. Finalize and release

- [ ] 9.1 Commit the change on the issue-linked `feature/2-domain-core` branch
      (Conventional Commits, microcommits, English, no co-authorship trailer), then push and
      open a PR referencing GitHub issue #2 — corrected from an earlier direct-to-main plan:
      the user clarified mid-implementation that direct-to-main was a one-time exception for
      `setup-monorepo` only; every change from here on lands via a PR on its issue-linked
      branch
- [ ] 9.2 Archive the OpenSpec change (`openspec/changes/domain-core/` →
      `openspec/changes/archive/`, sync `specs/domain-core/spec.md` into
      `openspec/specs/`) as part of the same PR — not a follow-up PR
- [ ] 9.3 After the PR merges, tag the resulting `main` commit `v0.2.0` and push the tag, per
      the project's SemVer convention (MINOR: new backward-compatible functionality, nothing
      from `v0.1.0` breaks)
