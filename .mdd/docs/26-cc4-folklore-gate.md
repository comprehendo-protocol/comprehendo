---
id: 26-cc4-folklore-gate
title: CC4 Folklore Gate
type: SPEC
path: Registry / Cross-Cutting Contracts / Folklore Gate
source_files: []
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: []
tags: [folklore-rule, provoked-by-test, drift-failure, native-and-registry]
test_files: []
known_issues: []
---

# CC4 Folklore Gate

## What to Build

A contract, not code: every twin code and every fix in every corpus,
native or registry, is provoked by a real test in CI, or it does not
ship. The gate diffs the catalog against induced coverage and rejects
unprovoked entries by name. A fix that stops being inducible after an
upstream change is surfaced as a drift failure, never silently retained.

## Architecture

Enforced by Submission Gate [29] at PR time for registry corpora, and by
the same discipline applied to native corpora (the Operator's corpus
passes this identical gate, one discipline for both tiers). Proven at
scale against a real corpus by ffmpeg Corpus [32] in Wave 6.

## Implementation Notes

- "Provoked" means an actual test in CI actually triggers the failure and
  actually observes the twin/fix, not a hand-written assertion that the
  shape looks plausible.
- Drift is a first-class failure mode, not a silent no-op: when an
  upstream release changes behavior such that a previously-inducible fix
  can no longer be provoked, the gate fails loudly rather than quietly
  keeping the stale entry.
- This is the mechanism that makes "the best twin is the one that never
  fires" operational: fences and heals still need an inducing test that
  proves the mistake WOULD have happened without the fence/heal.

## Data Model

N/A (a SPEC; the induced-coverage diff itself is Submission Gate [29]'s
implementation detail).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- Every twin `code` in a corpus has at least one CI test that induces it.
- Every fix has at least one CI test that induces the failure, applies
  the fix, and asserts success on retry.
- An entry with no inducing test is rejected by name at gate time, never
  silently dropped or silently accepted.
- A fix that stops being inducible (upstream changed) fails CI as drift,
  never silently kept as if still valid.

## Acceptance Criteria

- [x] The gate rejects a corpus submission containing an unprovoked twin
      code or fix, naming the specific entry. Submission Gate [29]'s
      `folkloreFindings` diffs the catalog against the coverage the gate
      itself OBSERVED while calling the really-installed package (never
      an author declaration, per this doc's Implementation Notes), and
      names both the twin code and the fix title:
      `gate-folklore.test.ts`, "rejects an unprovoked twin code BY NAME"
      and "rejects an unprovoked fix BY NAME, not merely its twin".
      Verified to have teeth: making the check return nothing turns 5
      tests red.
- [x] The gate runs identically against a native corpus (the Operator's)
      and a community submission. There is no tier parameter in
      `GateInput` to special-case on, which is the enforcement rather
      than an omission; `gate-folklore.test.ts`, "one discipline for
      both tiers", runs two real corpora through one gate call and
      asserts that the same defect in either produces identical check
      outcomes and identical finding kinds.
- [x] A synthetic drift scenario (a fix that stops reproducing) fails CI
      as drift, not as a silent pass. `gate-upstream.test.ts` installs a
      REAL later release of the toy target in which the cataloged
      rejection was dropped, and the gate answers `not-inducible` naming
      the code; `gate-folklore.test.ts` asserts that entry is reported
      once, as drift, and NOT as "no inducing test". Verified to have
      teeth: treating a non-throwing witness as induced turns 2 tests
      red.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
