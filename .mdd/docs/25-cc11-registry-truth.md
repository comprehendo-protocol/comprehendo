---
id: 25-cc11-registry-truth
title: CC11 Registry Truth
type: SPEC
path: Registry / Cross-Cutting Contracts / Registry Truth
source_files: []
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: []
tags: [registry-truth, typosquat, danger-lint, injection-lint, upstream-verification]
test_files: []
known_issues: []
---

# CC11 Registry Truth

## What to Build

A contract, not code: a corpus is a set of falsifiable claims about a
real package, and the gate verifies them against reality. CI installs the
actual target package from its actual registry, induces every cataloged
failure, and asserts the twin matches and the fix resolves it. A
fingerprint the real package cannot be induced to produce is rejected, so
routing cannot be hijacked by claiming another package's error patterns.
A corpus directory must exact-match a package that exists on the target
registry, so typosquat directories cannot land. Two lints on top of truth:
the danger lint (a destructive `apply` payload requires explicit
justification and elevated review) and the injection lint
(instruction-shaped content in `reason`, summaries, or docs prose is
rejected; corpus text is about the tool, never addressed to the agent).

## Architecture

Enforced by Submission Gate [29], the CI job that runs against every
registry corpus PR against `comprehendo-protocol/registry`. Also the
first thing Scoped Publisher [31] must trust before publishing.

## Implementation Notes

- "Installs the actual target package" is the load-bearing verb: this is
  not a static-analysis-only check, the gate really runs the real package
  in CI to prove each claim.
- The danger lint and injection lint are additive to truth-verification,
  not substitutes for it: a corpus can be truthful about a real
  destructive operation and still require elevated review for shipping
  it, and a corpus can be truthful and still get rejected for
  instruction-shaped prose that reads as addressed to the agent rather
  than about the tool.
- Typosquat protection is structural: the directory name itself must
  exact-match a real registry package name, not merely resemble one.

## Data Model

N/A (a SPEC; the corpus format itself is owned by Corpus Format [28]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- Every cataloged fingerprint in a corpus PR must be reproducible against
  the real installed target package in CI, or the fingerprint is
  rejected.
- Every fix's `apply` must resolve the induced failure on retry, verified
  in CI, not asserted by the author.
- A corpus directory name that does not exact-match a real registry
  package name is rejected (no typosquats).
- An `apply` payload invoking a destructive operation for its tool class
  requires explicit justification and elevated review (danger lint).
- Instruction-shaped content in `reason`, summaries, or docs prose is
  rejected (injection lint): corpus text is about the tool, never
  addressed to the agent.

## Acceptance Criteria

- [ ] The gate installs the real target package and reproduces every
      cataloged fingerprint in CI before accepting a corpus PR.
- [ ] A fingerprint the real package cannot be induced to produce is
      rejected, naming the failure.
- [ ] A directory name with no exact-match real package is rejected.
- [ ] The danger lint flags a destructive `apply` payload lacking
      justification.
- [ ] The injection lint rejects instruction-shaped prose in `reason`,
      summaries, or docs.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
