---
id: 05-negative-fixtures
title: Negative Fixtures
type: COMPONENT
path: Spec / Negative Fixtures
source_files: [packages/spec/kit/negative/]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-1
depends_on: [01-cc2-shape-identity, 03-shape-schemas, 04-conformance-fixtures]
tags: [negative-kit, must-fail, raw-error-leak, telemetry-attempt, schema-escaping-fix, ci-gate]
test_files: []
known_issues: []
---

# Negative Fixtures

## What to Build

The must-fail counterpart to every load-bearing rule: a raw-error leak, an
oversized topic, a schema-escaping fix, a telemetry attempt, a
provider-side corpus veto, and a computed (non-frozen) marker, each as its
own fixture, each asserted to fail its gate for its stated reason. CI
fails if any negative fixture instead passes its gate. Must-not: a
negative fixture that fails for the wrong reason (right rejection, wrong
diagnostic) does not satisfy this doc; the assertion checks the named
reason, not just a non-zero exit.

## Architecture

Lives in `packages/spec/kit/negative/`, run by the same CI job that runs
the positive Conformance Fixtures [04], asserting the opposite outcome.

## Implementation Notes

- Six required negative fixtures, each tied to the rule it must-fail:
  1. Raw-error leak -> CC3 [08], the negative kit's raw-leak fixture must
     fail (a conforming provider never surfaces a raw error as primary).
  2. Oversized topic -> CC5 [02], budget gate rejection.
  3. Schema-escaping fix -> CC7 [09], an `apply` that would express an
     operation outside the provider's declared call schema.
  4. Telemetry attempt -> CC6 [27], any network code anywhere in the
     scanned surface.
  5. Provider-side corpus veto -> CC8 [19], no manifest field can suppress
     a registry corpus.
  6. Computed marker -> CC9 [10], the marker must be a frozen literal,
     never computed or aliased.
- Each fixture's assertion names the specific rule violated, so a CI
  failure reads as "raw-error-leak fixture unexpectedly passed" rather
  than a bare red X.

## Data Model

Same fixture format as Conformance Fixtures [04] (validated against Shape
Schemas [03]), but each instance is deliberately non-conforming in exactly
one dimension.

## API/Interface

N/A (fixtures are test data, not runtime exports).

## Business Rules

- A negative fixture that passes its gate is a CI failure, full stop, no
  override.
- Each negative fixture isolates exactly one violation; a fixture that
  breaks two rules at once cannot pin down which gate caught it.

## Acceptance Criteria

- [ ] All six required negative fixtures exist (raw-error leak, oversized
      topic, schema-escaping fix, telemetry attempt, provider-side corpus
      veto, computed marker).
- [ ] CI runs them and asserts each fails for its named reason.
- [ ] CI is red if any negative fixture unexpectedly passes.

## Dependencies

- [01-cc2-shape-identity](01-cc2-shape-identity.md)
- [03-shape-schemas](03-shape-schemas.md)
- [04-conformance-fixtures](04-conformance-fixtures.md)

## Known Issues

None recorded at plan time.
