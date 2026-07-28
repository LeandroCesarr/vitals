# domain-core

## Purpose

TBD

## Requirements

### Requirement: Tag extraction from review comment text
The system SHALL extract tags from a review comment's body text in two forms: a structured
HTML-comment form (`<!-- metric: <name> level=<n> -->`) and a free-text bracket form
(`[<name>:<n>]`). Each extracted tag SHALL carry a metric name (lower-cased) and a numeric
severity level. A comment body may contain zero, one, or multiple tags of either form.

#### Scenario: Extract a structured HTML-comment tag
- **GIVEN** a review comment body containing `<!-- metric: lint level=1 -->`
- **WHEN** the tag parser processes the comment body
- **THEN** it returns a tag with metric `lint` and level `1`

#### Scenario: Extract a free-text bracket tag
- **GIVEN** a review comment body containing `[sql:2]`
- **WHEN** the tag parser processes the comment body
- **THEN** it returns a tag with metric `sql` and level `2`

#### Scenario: Extract multiple tags from one comment
- **GIVEN** a review comment body containing both `<!-- metric: lint level=1 -->` and
  `[security:3]`
- **WHEN** the tag parser processes the comment body
- **THEN** it returns both tags, one per form found

#### Scenario: No tags found in plain comment text
- **GIVEN** a review comment body with no tag markup
- **WHEN** the tag parser processes the comment body
- **THEN** it returns an empty list of tags

#### Scenario: Metric names are normalized to lowercase
- **GIVEN** a review comment body containing `[Lint:1]`
- **WHEN** the tag parser processes the comment body
- **THEN** it returns a tag with metric `lint` (lower-cased)

### Requirement: Weighted score calculation from parsed tags
The system SHALL compute a raw score from a list of parsed tags by, for each tag, multiplying
its severity level by the weight configured for its metric in the loaded rules configuration,
and summing the results across all tags. The computed score SHALL be returned together with
the `rules_version` of the rules configuration used to produce it.

#### Scenario: Score a single recognized tag
- **GIVEN** a rules configuration with weight `5` for metric `lint`
- **AND** a single parsed tag with metric `lint` and level `2`
- **WHEN** the scoring engine computes the score
- **THEN** the raw score is `10` (5 × 2)

#### Scenario: Sum scores across multiple tags
- **GIVEN** a rules configuration with weight `5` for `lint` and weight `15` for `sql`
- **AND** parsed tags `{lint, level 1}` and `{sql, level 1}`
- **WHEN** the scoring engine computes the score
- **THEN** the raw score is `20` (5 + 15)

#### Scenario: Unrecognized metrics contribute zero and do not fail
- **GIVEN** a rules configuration with no weight entry for metric `todo`
- **AND** a parsed tag with metric `todo` and level `1`
- **WHEN** the scoring engine computes the score
- **THEN** the computation succeeds and that tag contributes `0` to the raw score

#### Scenario: Result carries the configured rules version
- **GIVEN** a rules configuration with `version: "v1"`
- **WHEN** the scoring engine computes a score using that configuration
- **THEN** the result's `rulesVersion` is `"v1"`

#### Scenario: Score an empty tag list
- **GIVEN** a rules configuration with `version: "v1"`
- **AND** an empty list of parsed tags
- **WHEN** the scoring engine computes the score
- **THEN** the raw score is `0`, and the result's `rulesVersion` is still `"v1"`

### Requirement: Health calculation from raw score
The system SHALL derive a health value from a raw score as `100 - rawScore`, floored at `0`
(health is never negative).

#### Scenario: Health below maximum for a nonzero raw score
- **GIVEN** a raw score of `30`
- **WHEN** the health calculator computes health
- **THEN** the result is `70`

#### Scenario: Health floored at zero for a raw score above 100
- **GIVEN** a raw score of `150`
- **WHEN** the health calculator computes health
- **THEN** the result is `0`, not a negative number

#### Scenario: Health at maximum for a zero raw score
- **GIVEN** a raw score of `0`
- **WHEN** the health calculator computes health
- **THEN** the result is `100`

### Requirement: Domain entity timestamps are UTC
`PullRequest` and `ReviewComment` timestamp fields SHALL be represented in UTC. No timezone
conversion SHALL occur within `domain/` — conversion to a user's local timezone happens only
in the presentation layer, per the project's timezone convention.

#### Scenario: Entity construction preserves UTC instants
- **GIVEN** a UTC `Date` instant
- **WHEN** a `PullRequest` or `ReviewComment` entity is constructed with that instant as a
  timestamp field
- **THEN** the entity stores the same UTC instant unmodified, with no local-timezone
  conversion applied

### Requirement: VcsProviderPort contract
The system SHALL define a `VcsProviderPort` interface, identified by the
`VCS_PROVIDER_PORT` injection token, describing how to fetch a pull request and its review
comments. This change SHALL ship the interface and token only — no class implements this
port yet.

#### Scenario: Port and token are defined and importable
- **WHEN** `VcsProviderPort` and `VCS_PROVIDER_PORT` are imported from `domain/ports`
- **THEN** `VCS_PROVIDER_PORT` is a `Symbol`, and `VcsProviderPort` declares methods for
  fetching a pull request and its review comments, with no runtime implementation present in
  this change

### Requirement: ScoreRepositoryPort contract
The system SHALL define a `ScoreRepositoryPort` interface, identified by the
`SCORE_REPOSITORY_PORT` injection token, describing how to persist a computed health score
for a pull request. This change SHALL ship the interface and token only — no class
implements this port yet.

#### Scenario: Port and token are defined and importable
- **WHEN** `ScoreRepositoryPort` and `SCORE_REPOSITORY_PORT` are imported from `domain/ports`
- **THEN** `SCORE_REPOSITORY_PORT` is a `Symbol`, and `ScoreRepositoryPort` declares a method
  for saving a pull request's health score, with no runtime implementation present in this
  change

### Requirement: Domain module exports pure, framework-minimal services
The system SHALL provide a `DomainModule` that wires up and exports `TagParserService`,
`ScoringEngineService`, and `HealthCalculatorService` for consumption by future feature
modules. None of the three services, nor the entities and ports in this change, SHALL import
any VCS SDK (e.g. Octokit), ORM, or database client.

#### Scenario: Module exports the three domain services
- **GIVEN** `DomainModule` is imported into a NestJS application
- **WHEN** the module is resolved
- **THEN** `TagParserService`, `ScoringEngineService`, and `HealthCalculatorService` are
  available for injection by consumers of `DomainModule`

#### Scenario: No external SDK dependency in domain source
- **GIVEN** the source files under `domain/entities/`, `domain/ports/`, and
  `domain/services/`
- **WHEN** their imports are inspected
- **THEN** none of them import an Octokit, database, or other third-party VCS/persistence
  SDK
