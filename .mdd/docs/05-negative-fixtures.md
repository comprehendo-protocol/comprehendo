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
test_files: [packages/spec/test/negative-kit.test.mjs, packages/spec/test/negative-violations.test.mjs, packages/spec/test/negative-budget.test.mjs]
known_issues:
  - "[deferred] Only CC5's gate exists in Wave 1, so only `oversized-topic.json` is actually run through a real gate here (Budget Harness [06]: measured 1068 tokens against the 600-token topic budget, `npm run budget -- --scope topic --file <response>` exits 1). The other five fixtures are built and proven to be genuine, isolated violations, but nothing runs them through a gate yet, because the gate does not exist."
  - "[deferred] CC3 raw-error-leak enforcement lands with [08-cc3-no-raw-errors](08-cc3-no-raw-errors.md) in comprehendo-wave-2, against Twin Builder [12]. Building the scanner here would preempt that component's own build."
  - "[deferred] CC7 schema-escaping-fix enforcement lands with [09-cc7-schema-bound-fixes](09-cc7-schema-bound-fixes.md) in comprehendo-wave-2 (Twin Builder [12] at build time, Submission Gate [29] at PR time). Its concrete parser also waits on the `apply` grammar decision that doc records as an open question."
  - "[deferred] CC9 computed-marker enforcement lands with [10-cc9-marker-freeze](10-cc9-marker-freeze.md) in comprehendo-wave-2, against Marker & Probe [11] and re-run at the Wave 7 release gate."
  - "[deferred] CC8 provider-side-corpus-veto enforcement lands with [19-cc8-native-precedence](19-cc8-native-precedence.md) in comprehendo-wave-4, as the manifest-schema scan owned by Manifest Wiring [15]."
  - "[deferred] CC6 telemetry-attempt enforcement lands with [27-cc6-no-telemetry](27-cc6-no-telemetry.md) in comprehendo-wave-5, as the corpus network scan in Submission Gate [29]."
  - "[gap] This kit really does depend on Budget Harness [06] (`negative-budget.test.mjs` imports `kit/budget/measure.js` and spawns `kit/budget/run.js`), but `depends_on` cannot say so: the frontmatter rule requires depends_on to point at LOWER ids only, and the validator rejects `06-budget-harness` here. Both docs are in comprehendo-wave-1 and 06 was built first, so the real build order is satisfied; only the declaration is missing. Recorded rather than worked around."
  - "[deferred] No CI workflow step was added: `.github/workflows/` is shared infrastructure outside this feature's `source_files`, and the repo has no test workflow yet (06 recorded the same deferral). The kit needs none to run, it is picked up by `npm test` in `packages/spec`, the same `node --test` job that runs the positive kit."
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

Recorded in `known_issues` above. The short version: the six fixtures are
built, and five of the six gates that must reject them do not exist yet.
Each deferral names the SPEC doc and the wave that owns it (CC3 [08] and
CC7 [09] and CC9 [10] in Wave 2, CC8 [19] in Wave 4, CC6 [27] in Wave 5),
so "we chose not to build it here" is distinguishable from "we forgot".

What this build DOES settle for those five, and what a future gate cannot
settle for itself: each fixture is a valid instance of its shape (so it
would never fail a gate merely for being malformed) and is genuinely
non-conforming in exactly the one dimension it claims. The suite asserts
the specific violation in each case, and holds every fixture except the
oversized topic UNDER the CC5 budget, so no fixture quietly breaks two
rules at once.
