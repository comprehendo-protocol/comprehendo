---
id: 25-cc11-registry-truth
title: CC11 Registry Truth
type: SPEC
path: Registry / Cross-Cutting Contracts / Registry Truth
source_files: []
status: complete
phase: all
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

- [x] The gate installs the real target package and reproduces every
      cataloged fingerprint in CI before accepting a corpus PR. Split
      across the two halves it belongs to: the INSTALL is CI's own step
      (CC6 [27] forbids `child_process` inside `packages/registry-tools`,
      so a gate that shelled out to `npm install` would violate the
      contract it enforces), and Submission Gate [29]'s
      `verifyAgainstUpstream` receives that real install root, loads the
      real package out of it and really calls it.
      `gate-upstream.test.ts` performs the install for real (`npm pack`
      plus `npm install --offline` of a real tarball into a real
      node_modules tree) and asserts every cataloged fingerprint is
      really induced and every executable fix really resolves on retry.
      Structurally mandatory: a gate run with no verification reports
      `registryTruth` as `not-run`, which is never `pass`, so nothing can
      be marked publishable without it.
- [x] A fingerprint the real package cannot be induced to produce is
      rejected, naming the failure. `gate-upstream.test.ts` installs a
      REAL later release in which the cataloged failure no longer occurs
      (`not-inducible`, naming the code), and separately proves that a
      witness whose real failure routes to a DIFFERENT cataloged entry is
      rejected as `misrouted` naming the entry it actually matched, which
      is the routing-hijack case this contract exists for. Verified to
      have teeth: accepting a non-throwing witness as induced turns 2
      tests red.
- [x] A directory name with no exact-match real package is rejected.
      Structural, per this doc's Implementation Notes: the directory must
      resolve to an installed package AND that package must declare that
      exact name. `gate-upstream.test.ts` covers both, a directory
      nothing is installed under (`no-such-package`) and a directory
      whose installed package declares another name
      (`directory-mismatch`).
- [x] The danger lint flags a destructive `apply` payload lacking
      justification. `gate-lints.test.ts`: a destructive operation with
      no justification is flagged naming the operation, one justified by
      a topic that never mentions it is still flagged, and a destructive
      OPERAND on an ordinary operation (`-y`, ffmpeg's overwrite flag) is
      flagged too. A justified destructive apply still raises
      `elevatedReview`, so a bot never lands one. The corpus format has
      no dedicated justification field; the fix's `docs` pointer stands
      in and must name the token (recorded as a gap on [29]). Verified to
      have teeth: dropping the justification test turns 3 tests red.
- [x] The injection lint rejects instruction-shaped prose in `reason`,
      summaries, or docs. `gate-lints.test.ts` covers a twin reason, a
      topic summary, a fix title and a worked example's comment, and
      asserts the corpus as authored passes untouched. The phrase table
      is a floor and says so, and it deliberately rejects second-person
      prose, because this contract's rule is that corpus text is about
      the tool and never addressed to the agent.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
