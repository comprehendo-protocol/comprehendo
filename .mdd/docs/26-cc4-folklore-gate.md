---
id: 26-cc4-folklore-gate
title: CC4 Folklore Gate
type: SPEC
path: Registry / Cross-Cutting Contracts / Folklore Gate
source_files: []
status: planned
phase: idle
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

- [ ] The gate rejects a corpus submission containing an unprovoked twin
      code or fix, naming the specific entry.
- [ ] The gate runs identically against a native corpus (the Operator's)
      and a community submission.
- [ ] A synthetic drift scenario (a fix that stops reproducing) fails CI
      as drift, not as a silent pass.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
