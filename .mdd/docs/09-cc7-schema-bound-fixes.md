---
id: 09-cc7-schema-bound-fixes
title: CC7 Schema-Bound Fixes
type: SPEC
path: Core / Cross-Cutting Contracts / Schema-Bound Fixes
source_files: []
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: []
tags: [fix, apply-grammar, call-schema, docs-pointer, gate-time-check, security-fence]
test_files: []
known_issues: []
---

# CC7 Schema-Bound Fixes

## What to Build

A contract, not code: every `apply` in every corpus (native or registry)
parses against the provider's declared call schema at gate time. A fix
that would express an operation the provider does not define is rejected,
not accepted and left to fail at runtime. `docs` pointers on a fix are
checked against the corpus index so a fix can never point at a topic that
does not exist. This is the security fence: corpus text is data, never
instructions, so a compromised or careless corpus cannot smuggle an
operation the provider never declared.

## Architecture

Enforced by Twin Builder [12] at build time (a build with a fix whose
`apply` does not parse against the declared schema fails the build) and
by Submission Gate [29] at registry-corpus-PR time (the same check,
applied to community submissions).

## Implementation Notes

- The `apply` grammar itself is one of the Wave-1 open design questions:
  the sample corpora surfaced two forms, literal code and a `template`
  form with placeholders bound from fingerprint capture groups. Whichever
  form Wave 1 rules on, this contract applies identically to both: the
  resolved operation must be inside the provider's declared schema.
- "Gate time," not "runtime": this check happens before a fix ships, not
  as a runtime guard that could be bypassed. A fix that fails this check
  never reaches a published corpus.

## Data Model

N/A (a SPEC; the fix shape itself is owned by Shape Schemas [03]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- A fix's `apply` must resolve to an operation inside the provider's own
  declared call schema; anything outside it is rejected at gate time.
- A fix's `docs` pointer must resolve to a topic that exists in the same
  corpus's index; a dangling pointer is rejected at gate time.
- This check runs identically for native provider builds (Twin Builder
  [12]) and community registry submissions (Submission Gate [29]): one
  discipline, two tiers.

## Acceptance Criteria

- [ ] A fix whose `apply` would express an operation outside the
      provider's declared schema fails the build (native) or the gate
      (registry), naming the violation.
- [ ] A fix whose `docs` pointer targets a nonexistent topic fails the
      same way.
- [ ] The negative kit's schema-escaping-fix fixture (Negative Fixtures
      [05]) fails its gate.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

- [gap] The `apply` grammar (literal vs. `template` with placeholders) is
  an open Wave-1 design question in the source spec; this contract's
  concrete parser depends on that decision landing first.
