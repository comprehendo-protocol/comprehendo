---
id: 21-fingerprint-index-matcher
title: Fingerprint Index & Matcher
type: COMPONENT
path: Registry / Fingerprint Index
source_files: [packages/registry-tools/src/fingerprint.ts, packages/registry-tools/src/fingerprint-facets.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: [20-cc10-honest-miss]
tags: [fingerprint, static-index, error-class, stack-shape, precision-first, static-pattern]
test_files: [packages/registry-tools/test/fingerprint-index.test.ts, packages/registry-tools/test/fingerprint-collision.test.ts, packages/registry-tools/test/fingerprint-match.test.ts, packages/registry-tools/test/cc10-honest-miss.property.test.ts, packages/registry-tools/test/unstructured-shape-drift.test.ts]
known_issues: [{type: gap, note: "The static-pattern fingerprint kind (matching source rather than runtime errors) is an open Wave-1 design question: who runs it (wrap(), lint integration, or both) is not yet decided."}, {type: gap, note: "registry-tools takes no runtime import from core (packages install independently; a ../../core/src import from src/ breaks rootDir), so the three UNSTRUCTURED literals this component produces are duplicated rather than shared. A drift test reads core's actual source and packages/spec/kit/shapes/undocumented.schema.json directly to keep the duplicate honest, but a real shared-constants package (if one is ever wanted) is a later call, not this feature's."}]
---

# Fingerprint Index & Matcher

## What to Build

A static fingerprint index built at registry build time from error-class
names, message patterns, and stack shapes, with no runtime learning and
no heuristic drift. The matcher looks up a raw caught error against this
index. Precision-first: an ambiguous match returns UNSTRUCTURED with
candidates named (CC10 [20]), never a best guess. Must-not: no runtime
fingerprint learning; the index is compiled once at build time and is
otherwise static.

## Architecture

`packages/registry-tools/src/fingerprint.ts` builds the static index at
registry build time. Router & Precedence [22] (`packages/core/src/router.ts`)
consumes the compiled index at runtime to match a caught error against a
corpus. ffmpeg Fingerprints [33] (Wave 6) is the first real corpus this
matcher is proven against at scale.

## Implementation Notes

- Three fingerprint sources: error-class names, message patterns, and
  stack shapes. All three are compiled to the static index, no single
  source is treated as authoritative alone.
- The `static-pattern` fingerprint kind (matching source rather than
  runtime errors, surfaced by the zod sample corpus) is an open Wave-1
  design question: who runs static matching (`wrap()`, a lint
  integration, or both) is not yet ruled on. This component's index
  format should not foreclose that decision.
- Cross-registry collision is a build-time concern: a corpus update that
  would create a fingerprint collision with another package's corpus
  fails the registry build (enforced jointly with Submission Gate [29]).

## Data Model

Fingerprint index entry: `{ package, errorClass?, messagePattern?,
stackShape?, corpusEntryId }`, compiled into a single static artifact at
registry build time.

## API/Interface

N/A as a consumer-facing primitive; this is infrastructure consumed by
Router & Precedence [22]'s `comprehend(raw)` surface, not called directly
by agents.

## Business Rules

- The index is static: built once at registry build time, never mutated
  at runtime, no learning from live traffic.
- An ambiguous match (more than one plausible candidate) returns
  UNSTRUCTURED with candidates named, never a confident wrong guess.
- A fingerprint collision across two packages' corpora fails the registry
  build, never silently picks one.

## Acceptance Criteria

- [x] The index builds deterministically from a corpus's declared
      fingerprints (error class, message pattern, stack shape).
- [x] An ambiguous input degrades to UNSTRUCTURED with named candidates
      (CC10 [20] property test). Verified to have teeth: patching the
      matcher to guess a best candidate instead of degrading turned 16
      tests red.
- [x] A synthetic cross-package collision fails the registry build with
      the colliding packages named. (Enforced by index construction
      itself; Submission Gate [29]'s CI wrapper around this check is
      Wave 5's job, not built here.)

## Dependencies

- [20-cc10-honest-miss](20-cc10-honest-miss.md)

## Known Issues

- [gap] The `static-pattern` fingerprint kind (matching source rather
  than runtime errors) is an open Wave-1 design question: who runs it
  (`wrap()`, lint integration, or both) is not yet decided.
- [gap] `registry-tools` takes no runtime import from `core` (packages
  install independently; a `../../core/src` import from `src/` would
  break `rootDir`), so the three UNSTRUCTURED literals this component
  produces are duplicated rather than shared. A drift test reads
  core's actual source and `packages/spec/kit/shapes/undocumented.schema.json`
  directly to keep the duplicate honest.

## Fixed Issues

### Two entries sharing an id with different facets silently dropped one (fixed 2026-08-22)

Found by review. Two entries sharing `package#corpusEntryId` but
declaring DIFFERENT facets fell through both the id-based dedup (last
write wins) and the signature-based collision check (they land in
different signature buckets), so one entry vanished silently and
order-dependently instead of failing the build, the exact silent-pick
failure mode the collision detector exists to prevent, on the id axis
instead of the fingerprint-signature axis.

- Fixed by `identityDefects()`, which checks for this before the
  dedup step and raises a `FingerprintIndexError` naming the id. An
  identical entry declared twice (same id AND same facets) remains a
  legitimate no-op dedup, unaffected. Mutation-verified: 2 new tests,
  both red without the fix, one specifically proving the refusal is
  order-independent.
