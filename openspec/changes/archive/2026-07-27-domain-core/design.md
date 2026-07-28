## Context

`apps/api` currently ships empty (just the generator's default `AppModule`/`AppController`/
`AppService`, from `setup-monorepo`). This change adds the first real code: the domain layer
that every future feature module (`github/`, `persistence/`, `metrics/`) will orchestrate
against. Nothing in this change talks to a real VCS, a database, or an HTTP client — it is
pure business logic, built test-first per `openspec/config.yaml`'s TDD mandate for
`domain/services`.

## Goals / Non-Goals

**Goals:**
- Land `PullRequest`, `ReviewComment`, `HealthScore` as plain, dependency-free entities.
- Define `VcsProviderPort` and `ScoreRepositoryPort` as the contracts future adapters
  (`github-provider`, `persistence`) must implement — intentionally minimal, grown later as
  real adapters need more.
- Land `TagParserService`, `ScoringEngineService`, `HealthCalculatorService` as pure,
  100%-decision-path-tested services, wired into `domain.module.ts`.
- Establish the `rules.json` shape and the `rules_version` propagation convention now, since
  every later scoring-related change depends on this contract being stable.

**Non-Goals:**
- No real VCS integration (`github-provider`), no persistence (`persistence`), no HTTP
  exposure (`metrics-api`) — this change has zero I/O inside `domain/`.
- No structural metrics (PR lifetime, review-cycle count) — `PullRequest` carries only the
  fields needed by this change and by the ports; `structural-metrics` extends it later.
- No `rules.json` calibration — the shipped file is a minimal, clearly-placeholder example.
- No real tag catalog beyond what's needed to prove the parsing/scoring pipeline works
  end-to-end (`lint`, `sql`, `security`, matching the proposal's examples).

## Decisions

### 1. Entities are plain classes, zero decorators
`PullRequest`, `ReviewComment`, `HealthScore` live in `apps/api/src/domain/entities/` as
plain TypeScript classes with `readonly` properties set via constructor — no
`@nestjs/common` decorators at all. Entities are data created by application code (parsed
from a VCS response, computed by a service), never DI-injected themselves, so "the strict
minimum needed for DI" (per the proposal) works out to zero decorators here. `@Injectable()`
is reserved for the *services* (decision #6), which is where DI actually applies.

Shapes use small, shared value objects for anything that isn't a single scalar concept —
`author`, `repository` — instead of flattening every field onto the entity itself. Every
value object is a **class**, not an interface — consistent with entities themselves, so
there is exactly one construction style across `domain/entities/`, not two. Closed sets of
known values (`vcsProvider`, PR `state`) are TypeScript `enum`s living in their own
`domain/enums/` directory, not string-literal unions — a `VcsProvider`/`PullRequestState`
import site makes it obvious these are a fixed, named vocabulary, not an arbitrary string:
```ts
// enums/vcs-provider.enum.ts
export enum VcsProvider {
  GITHUB = "github",
  // GitLab/Bitbucket added here once those changes land — no speculative entries now.
}

// enums/pull-request-state.enum.ts
export enum PullRequestState {
  OPEN = "open",
  CLOSED = "closed",
  MERGED = "merged",
}

// entities/author.ts
export class Author {
  constructor(readonly name: string) {}  // VCS username
}

// entities/repository.ts
export class Repository {
  constructor(
    readonly vcsProvider: VcsProvider,  // natural key component
    readonly fullName: string,          // e.g. "org/repo" — natural key component
  ) {}
}

// entities/pull-request.ts
export class PullRequest {
  constructor(
    readonly repository: Repository,
    readonly number: number,            // natural key component (PR number within the repo)
    readonly title: string,
    readonly author: Author,
    readonly state: PullRequestState,
    readonly createdAt: Date,           // UTC, per config.yaml's timezone rule
    readonly updatedAt: Date,           // UTC
  ) {}
}

// entities/review-comment.ts
export class ReviewComment {
  constructor(
    readonly id: string,
    readonly author: Author,
    readonly body: string,              // raw text — TagParserService needs it to parse tags
    readonly createdAt: Date,           // UTC
  ) {}
}

// entities/health-score.ts
export class HealthScore {
  constructor(
    readonly rawScore: number,          // sum of weighted tag points, floor 0 (no cap)
    readonly health: number,            // 100 - rawScore, floored at 0
    readonly rulesVersion: string,      // which rules.json version produced this
  ) {}
}
```
`Author` is shared between `PullRequest` and `ReviewComment` (one shape, one file) rather
than redeclared per entity — both mean the same thing: whoever the VCS says performed the
action. `PullRequest.repository` groups the two natural-key fields that describe *where* the
PR lives; `number` stays a direct property of `PullRequest` since it only means something in
the context of a specific `PullRequest`, not as a standalone value object. Together,
`repository` + `number` still mirror `openspec/config.yaml`'s sync-idempotency convention
(`vcs_provider, repo_full_name, pr_number`) even though nothing persists it yet, so
`persistence` doesn't have to renegotiate the key shape later. `ReviewComment.body` keeps the
raw text at the domain level because `TagParserService` needs it; whether `persistence`
chooses to store the full body or only the extracted tags is that change's call, not this
one's — `openspec/config.yaml`'s "don't persist full diffs" rule is about diffs, not comment
bodies, and doesn't constrain this. `HealthScore` stays flat — its three fields (`rawScore`,
`health`, `rulesVersion`) are each their own independent scalar concept, not naturally
grouped, so nesting them would just add indirection with no shared meaning.

**Alternative considered**: entities as plain `type` aliases (no class, no constructor).
Rejected — a class gives a single, obvious construction point and lets `HealthScore` assert
`health = max(0, 100 - rawScore)` in one place (the constructor) instead of every caller
having to remember to floor it.

### 2. Ports: minimal interface + `Symbol` token, per existing convention
```ts
// vcs-provider.port.ts
export const VCS_PROVIDER_PORT = Symbol("VCS_PROVIDER_PORT");

export interface VcsProviderPort {
  fetchPullRequest(repoFullName: string, prNumber: number): Promise<PullRequest>;
  fetchReviewComments(repoFullName: string, prNumber: number): Promise<ReviewComment[]>;
}

// score-repository.port.ts
export const SCORE_REPOSITORY_PORT = Symbol("SCORE_REPOSITORY_PORT");

export interface ScoreRepositoryPort {
  save(pullRequest: PullRequest, score: HealthScore): Promise<void>;
}
```
Kept intentionally small — just enough surface for `github-provider` and `persistence` to
have something concrete to implement against. Expanding these interfaces later (e.g. adding
`fetchRateLimit()` for the VCS-resilience convention) is expected and is each of those
changes' job, not this one's — `domain/` defines the contract, it doesn't anticipate every
future adapter need speculatively.

**Alternative considered**: define richer ports now (rate-limit checks, pagination cursors,
batch fetch) to avoid touching them again later. Rejected — YAGNI; `github-provider` will
know the real shape once it's built against the actual GitHub API, and changing an
interface with zero implementations yet costs nothing.

### 3. `TagParserService`: two tag formats, one `Tag` shape, regex-based
```ts
// tag.ts (domain/entities/ — a parsed tag, not a VCS/API concept)
export interface Tag {
  readonly metric: string;  // e.g. "lint", "sql", "security"
  readonly level: number;   // severity multiplier, e.g. 1, 2, 3
}
```
`TagParserService.parse(commentBody: string): Tag[]` scans for both forms in the same pass:
- Structured: `<!-- metric: lint level=1 -->` → `{ metric: "lint", level: 1 }`
- Free-text bracket: `[lint:1]` → `{ metric: "lint", level: 1 }`

A comment can contain multiple tags of either form; all are returned. Metric names are
lower-cased on parse (`Lint` and `lint` are the same tag) so `ScoringEngineService`'s
lookup in decision #4 doesn't have to normalize again.

**Alternative considered**: a single unified regex covering both forms via alternation.
Rejected in favor of two focused regexes run in sequence — clearer to read, easier to add a
third format later without reshaping one giant pattern, and the performance difference is
irrelevant at comment-body scale.

### 4. `ScoringEngineService`: `weight × level` per tag, lenient on unknown metrics
`rules.json` shape:
```json
{
  "version": "v1",
  "weights": {
    "lint": 5,
    "sql": 15,
    "security": 25
  }
}
```
`ScoringEngineService.score(tags: Tag[]): { rawScore: number; rulesVersion: string }`
computes `rawScore = sum(weights[tag.metric] * tag.level for each tag)`. A tag whose
`metric` has no entry in `weights` contributes `0` (ignored, not an error) — a comment can
legitimately contain bracket-like text that isn't a real tag (e.g. someone typing
`[TODO:1]` in a discussion), and one unrecognized tag shouldn't fail the whole PR's scoring
run. `rulesVersion` comes straight from `rules.json`'s `version` field and is returned
alongside the score so the caller (a future orchestration service) can stamp it on the
`HealthScore` it builds — `ScoringEngineService` itself doesn't construct `HealthScore`
(that mixes two concerns; decision #5 owns the score → health transform).

**Alternative considered**: throw on an unrecognized metric, forcing `rules.json` to be kept
in lockstep with every tag ever used in a comment. Rejected — too brittle for something
driven by free-text human comments; a typo or a non-tag bracket shouldn't break a sync run.

### 5. `HealthCalculatorService`: single pure function, floor at 0
`HealthCalculatorService.calculate(rawScore: number): number` returns
`Math.max(0, 100 - rawScore)`. No cap on the input side (a `rawScore` of 500 is valid input,
just yields `health = 0`) — capping `rawScore` itself would hide how bad a PR really is from
whatever later reporting layer wants the raw number.

**Composing the three services stays outside `domain/` — but is still tested here.** No
orchestration service ships in this change (the architecture reserves that for feature
modules — `pr-sync`, most likely — which will inject `VcsProviderPort`, call all three
domain services, and use `ScoreRepositoryPort` to persist the result). That means nothing
in this change ever constructs a `HealthScore` from real service output *except* one
integration test (tasks.md, section 8): each service's own unit tests only exercise it with
hand-written fixtures, never another service's actual output, so a mismatch at the seam
between two services (e.g. `TagParserService` emitting a metric string that
`ScoringEngineService` doesn't recognize due to a subtle formatting difference) could pass
every unit test and still be broken end-to-end. The integration test chains all three real
services together once, proving the composition — without adding a real orchestration
service, which stays out of scope here.

**Lives in a dedicated integration-test directory, not next to the unit specs.**
`apps/api/test/integration/domain-pipeline.integration.spec.ts` (`.integration.spec.ts`
suffix), not `apps/api/src/domain/*.spec.ts` — per user direction, to keep integration tests
(which cross multiple services/modules) visibly separate from the co-located
`*.spec.ts` unit tests each service already has next to it. `vitest.config.ts`'s
`include: ['**/*.spec.ts']` already covers this path with no config change needed.

### 6. Domain module wiring: `rules.json` parsed in the module, not the service
`ScoringEngineService` takes its weights via constructor injection
(`@Inject(RULES_CONFIG) rulesConfig: RulesConfig`), not by reading `apps/api/rules.json`
itself. `domain.module.ts` provides `RULES_CONFIG` via a factory that reads and parses the
JSON file once at module init:
```ts
// rules-config.ts
export const RULES_CONFIG = Symbol("RULES_CONFIG");

// domain.module.ts
@Module({
  providers: [
    { provide: RULES_CONFIG, useFactory: () => loadRulesConfig() },
    TagParserService,
    ScoringEngineService,
    HealthCalculatorService,
  ],
  exports: [TagParserService, ScoringEngineService, HealthCalculatorService],
})
export class DomainModule {}
```
**Deviation from an earlier draft of this decision, applied during implementation**:
`RULES_CONFIG` is colocated in `rules-config.ts` next to `RulesConfig`/`loadRulesConfig()`,
not defined inline in `domain.module.ts` as first sketched here — matching the port-token
convention already established in decision #2 (`VCS_PROVIDER_PORT` lives in
`vcs-provider.port.ts`, `SCORE_REPOSITORY_PORT` in `score-repository.port.ts`; a token
always lives beside what it represents, never in the module that just wires it up).

This keeps `ScoringEngineService` itself free of file I/O — unit tests construct it with an
in-memory `RulesConfig` object, never touching the filesystem, which is what makes 100%
decision-path coverage practical without mocking `fs`. The config-loading utility
(`loadRulesConfig()`) lives in `domain/` too (it's not calling an external SDK, just Node's
built-in `fs` + `JSON.parse`), but it is explicitly *not* part of the TDD-mandatory service
set — it's plumbing, not a decision path, and is covered pragmatically (one test confirming
it parses the shipped `rules.json` into the expected shape).

**Failure mode is fail-fast, on purpose.** `loadRulesConfig()` does not catch or swallow
errors from `fs.readFileSync` (missing file) or `JSON.parse` (malformed file) — either
propagates straight out of the `useFactory`, which means Nest fails application bootstrap
if `rules.json` is missing or invalid. No try/catch, no fallback default weights. Scoring
rules are load-bearing business configuration, not an optional nicety — an app that started
successfully without them would silently score every PR with whatever a fallback produced,
which is worse than not starting at all.

**No new dependency needed.** `rules.json` is parsed with native `JSON.parse` — no YAML
library required. An earlier draft of this design used `rules.yaml` (needing `js-yaml`);
switched to JSON specifically to drop that dependency, at the cost of the file not
supporting inline comments the way YAML would (acceptable — the placeholder-weights caveat
lives in this document and the proposal, not inline in the config file itself).

**Alternative considered**: have `ScoringEngineService` read the file itself (inject a file
path, not a parsed config). Rejected — would force every unit test to either hit the real
filesystem or mock `fs`, both worse than just injecting the already-parsed shape.

### 7. `@/*` path alias for all `domain/` imports, rewritten for runtime via `tsc-alias`
Every import within `domain/` — including between siblings in the same folder — uses a
`@/*` → `src/*` path alias (e.g. `@/domain/entities/author.entity.js`) instead of relative
paths (`./author.entity.js`, `../entities/author.entity.js`), per explicit user preference
for a single, consistent import style regardless of file location.

`apps/api` builds via plain `nest build` (`tsc`, not webpack), and `tsc` does not rewrite
alias specifiers when it compiles — a `paths`-mapped import would remain literally
`@/domain/...` in the compiled `dist/*.js`, which Node cannot resolve at runtime (confirmed
by inspecting `dist/` output before fixing this). `tsc-alias` runs as a second build step
(`nest build && tsc-alias -p tsconfig.build.json`) and rewrites every alias specifier in
`dist/` into a working relative path. Verified with a throwaway value-import test that the
rewritten path is correct and resolvable. Vitest needs the equivalent mapping for the same
reason but via a different mechanism: tests run directly against `.ts` source (no `dist/`
involved, confirmed by deleting `dist/` entirely and re-running a test), so
`vitest.config.ts` declares its own `resolve.alias` (`@` → `./src`) — Vite's resolver
applies this before the file ever reaches the TypeScript transform.

**A second, separate alias covers test-only helpers.** `apps/api/test/builders/*.builder.ts`
sits outside `src/`, so `@/*` (which only maps to `src/*`) can't reach it. Rather than fall
back to relative paths (`../../../test/builders/...`) for spec files under `src/domain/`,
a dedicated `@test/*` → `./test/*` alias was added alongside `@/*`, in both
`tsconfig.json`'s `paths` and `vitest.config.ts`'s `resolve.alias` — keeping the "no relative
imports" convention consistent for test files too, not just production code. `@test/*` is
dev-only (spec files never ship in `dist/`), so it doesn't need the `tsc-alias` rewrite step
that `@/*` requires for the production build.

**Extensions stay required (`.js`, not extension-less), for now.** The user asked whether
extension-less imports were possible; they require either `moduleResolution: "bundler"` or
an actual bundler for the production build. `moduleResolution: "bundler"` was tried and
TypeScript 6.0 hard-rejects it (`TS5109`) whenever `module` is `"NodeNext"` — the two must
match. Dropping extensions for real (not just at the type-checking level) needs `apps/api`
to bundle its production output (e.g. NestJS's webpack builder) so Node never sees a raw,
unresolved import specifier at all. That's a bigger structural change than this task
warrants; deferred, tracked as an open question below rather than done here.

**Alternative considered**: keep relative imports for same-folder siblings, alias only
across folders (e.g. `entities/pull-request.entity.ts` importing `./author.entity.js`
relatively but `../enums/pull-request-state.enum.js` via `@/domain/enums/...`). Rejected —
explicit user preference for one single import style everywhere, no case-by-case judgment
calls about when to use which.

### 8. Test data via the Builder pattern (GoF/refactoring.guru), not ad-hoc fixtures
Every entity gets a corresponding builder in `apps/api/test/builders/` (`AuthorBuilder`,
`RepositoryBuilder`, `TagBuilder`, `PullRequestBuilder`, `ReviewCommentBuilder`,
`HealthScoreBuilder`), all extending a shared abstract `Builder<T>` base
(`apps/api/test/builders/builder.ts`) that provides `buildMany(count)` for free on top of
each subclass's `build()`. Each builder's private fields default to
`@faker-js/faker`-generated values (so tests that don't care about a specific value get
realistic, varied data for free, and `buildMany(n)` produces `n` distinct entities rather
than `n` identical clones), with fluent `with*(...)` setters to override any field
explicitly when a test needs a deterministic value (which is most TDD scenarios in sections
3/5/6 — a test asserting "score is exactly 10" needs a `Tag` with an exact, known
`metric`/`level`, not a random one). `PullRequestBuilder` and `ReviewCommentBuilder` compose
`RepositoryBuilder`/`AuthorBuilder` internally for their nested value objects' defaults,
themselves overridable via `withRepository(...)`/`withAuthor(...)`.

`@faker-js/faker` (not the deprecated, unscoped `faker` package — see risk below) is a
dev-only dependency of `apps/api`.

**Alternative considered**: plain factory functions with an `overrides` object parameter
(`createAuthor({ name: "x" })`) instead of a class-based fluent builder. Rejected per
explicit user request for the classic Builder pattern specifically (chainable `with*`
methods + `build()`/`buildMany()`), not a factory-function shortcut.

### Domain purity check (per config.yaml design rules)
No `domain/services` file imports Octokit, Prisma, or any VCS/DB SDK. The only "framework"
touches are `@nestjs/common`'s `@Injectable()`/`@Inject()` on the three services and the
`RULES_CONFIG` factory provider — exactly the "strict minimum needed for DI" the proposal
calls out, and consistent with how `openspec/config.yaml` already scopes the "never imports
Octokit/Prisma/any external SDK" rule to third-party integration SDKs, not to the NestJS DI
container itself. `rules.json` is parsed with native `JSON.parse` — no parsing library at
all, let alone a VCS/persistence SDK.

## Risks / Trade-offs

- **[Risk]** The `weight × level` scoring formula and the "unknown metric = 0" leniency are
  both real product decisions being made here, ahead of any real calibration data.
  → **Mitigation**: `rules.json` is explicitly documented as a placeholder (proposal, "Out
  of scope"); the formula lives in one function (`ScoringEngineService.score`), so changing
  it later — even to a non-linear formula — doesn't ripple through the ports or entities.
- **[Risk]** `PullRequest`'s natural-key fields are fixed now, before any adapter exists to
  confirm a real VCS response maps onto them cleanly. → **Mitigation**: fields chosen
  directly from `openspec/config.yaml`'s own sync-idempotency convention
  (`vcs_provider, repo_full_name, pr_number`), which was already decided independent of this
  change; low risk of mismatch when `github-provider` lands.
- **[Risk]** `PullRequest.state: PullRequestState` (`OPEN | CLOSED | MERGED`) is a 3-way
  enum, but GitHub's actual API models this as `state: "open" | "closed"` plus a separate
  `merged: boolean` — a merged PR has `state: "closed"` *and* `merged: true` simultaneously,
  not a third state value. → **Mitigation (rule, binding on `github-provider`)**: when
  mapping a GitHub API response onto `PullRequest`, if `merged` is `true`, set
  `PullRequestState.MERGED` (regardless of the raw `state` value); otherwise map the raw
  `state` value to `PullRequestState.OPEN`/`CLOSED` as-is. Documented here now so
  `github-provider` doesn't have to rediscover this mapping decision from scratch.
- **[Risk]** `VcsProviderPort`/`ScoreRepositoryPort` are minimal by design (decision #2),
  meaning `github-provider` and `persistence` will almost certainly need to extend them.
  → **Mitigation**: intentional trade-off (YAGNI over speculative completeness); extending
  an interface with zero implementations is cheap, and both future changes own that cost
  explicitly rather than this change guessing wrong now.
- **[Risk]** `@faker-js/faker`'s name is one character away from `faker`, the unscoped
  package whose original maintainer deliberately sabotaged it (infinite loop, corrupted
  output) in January 2022 after which it was deprecated. → **Mitigation**: verified before
  adding — `@faker-js/faker` is the actively maintained community fork (org `faker-js` on
  GitHub, dedicated site fakerjs.dev, recent release history), not the compromised package;
  confirmed via `npm view` metadata (repository URL, maintainers) before installing, not
  from memory alone.
- **[Risk]** `tsc-alias` is a second build step glued on after `nest build`; if it's ever
  removed from the `build` script (e.g. someone "simplifies" it back to plain `nest build`),
  every `@/*` import breaks at runtime with no build-time warning — `tsc --noEmit` still
  passes (`paths` resolves fine for type-checking) even though `dist/` would be broken.
  → **Mitigation**: task 8.3 in `tasks.md` explicitly runs the real built `dist/` output
  (via `pnpm turbo run build` + a boot/smoke check pattern already used in
  `setup-monorepo`), which would catch this class of failure before merge.

## Migration Plan

Not applicable — purely additive new code, nothing else in the repo imports or calls it yet
(no existing behavior to migrate or risk regressing).

## Open Questions

- **Extension-less imports** (dropping the `.js` suffix `@/*` imports currently need) would
  require switching `apps/api`'s production build to an actual bundler (NestJS's webpack
  builder, most likely), which also removes the need for `tsc-alias`. Explicitly deferred by
  the user ("depois vejo isso") — not resolved in this change, current `.js`-suffixed
  aliased imports stay as the convention until a future change (or a follow-up decision)
  takes on the webpack-builder migration deliberately.
- The real `rules.json` weight calibration is explicitly deferred (proposal, "Out of scope")
  and isn't a question this change needs to answer.
