## Why

The monorepo scaffolding exists (`setup-monorepo`), but no business rule is implemented yet.
Without a domain layer, nothing else has anything to orchestrate: VCS adapters would have no
port to implement, persistence would have no entity to store, and the future metrics API
would have no service to call. Tracked by GitHub issue #2.

## What Changes

- Add `domain/entities/`: `PullRequest`, `ReviewComment`, `HealthScore` — plain
  types/classes, no framework decorators beyond the strict minimum needed for DI
  (constructor injection where applicable), no Octokit/Prisma/any external SDK import.
- Add `domain/ports/`: `VcsProviderPort` and `ScoreRepositoryPort` interfaces, each with an
  injection token (`VCS_PROVIDER_PORT`, `SCORE_REPOSITORY_PORT`) following the `Symbol` +
  `_PORT` suffix convention. These are contracts only — no implementation ships in this
  change.
- Add `domain/services/`:
  - `TagParserService`: extracts tags from review comments, supporting both a structured
    HTML-comment form (e.g. `<!-- metric: lint level=1 -->`) and a free-text bracket form
    (e.g. `[lint:1]`).
  - `ScoringEngineService`: applies the weights defined in `rules.json` to the tags
    extracted by `TagParserService`, computing a raw score. Every calculation records which
    `rules_version` produced it.
  - `HealthCalculatorService`: derives health from the raw score (`100 - points`, floored
    at `0`).
- Add `domain/domain.module.ts` exporting the three services above for future feature
  modules to import.
- Add an initial `rules.json` — minimal/placeholder weights, since real calibration happens
  later, but present so `ScoringEngineService` has something real to read.

All three services are pure: no I/O, no framework/external SDK dependency, built
test-first (red → green → refactor) with 100% coverage of decision paths, per
`openspec/config.yaml`'s TDD mandate for `domain/services`.

## Capabilities

### New Capabilities
- `domain-core`: the domain layer's entities, ports, and pure business services (tag
  parsing, scoring, health calculation) that every future feature module orchestrates
  against.

### Modified Capabilities
- None. `project-scaffolding` (the only existing capability) has no requirement changing —
  this change only adds new application code inside the scaffolding already in place.

## Impact

- **New code**: `apps/api/src/domain/entities/*.entity.ts`,
  `apps/api/src/domain/enums/*.enum.ts` (`VcsProvider`, `PullRequestState`),
  `apps/api/src/domain/ports/*.port.ts`, `apps/api/src/domain/services/*.service.ts`,
  `apps/api/src/domain/domain.module.ts`, `apps/api/rules.json`,
  `apps/api/test/builders/*.builder.ts` (test-only entity builders) — exact paths confirmed
  in design.md.
- **Dependencies introduced**: none to parse `rules.json` — native `JSON.parse`/
  `resolveJsonModule`, no library needed (this was `js-yaml`/YAML in an earlier draft;
  switched to JSON specifically to avoid the extra dependency). `tsc-alias` and a
  `@/*` → `src/*` TS path alias (dev-only, so `domain/` files can import each other via
  `@/domain/...` instead of relative paths); `@faker-js/faker` (dev-only, random test data
  for the entity builders) — confirmed this is the actively maintained community fork, not
  the unrelated `faker` package whose original maintainer sabotaged it in 2022. Nothing
  beyond what `setup-monorepo` already installed for Vitest/TDD itself.
- **VCS integration**: `VcsProviderPort` is *defined* by this change (the contract every
  future VCS adapter must implement), but **no VCS integration ships here** — no Octokit,
  no GitHub API calls, no adapter implementing the port. That's `github-provider`'s job;
  `domain/` never imports an external SDK, per the architecture's most important rule.
  Same for `ScoreRepositoryPort`: defined here, implemented later by `persistence`.
- **Out of scope**: any real GitHub/VCS integration, database persistence, or API exposure.
  These services are pure and have no I/O — deferred to `github-provider`, `persistence`,
  and `metrics-api` respectively.
- **Expected SemVer bump**: **MINOR (0.2.0)**. New backward-compatible functionality
  (business rules), nothing from `setup-monorepo` (0.1.0) breaks — the domain layer is
  purely additive, not yet wired into any running behavior.
