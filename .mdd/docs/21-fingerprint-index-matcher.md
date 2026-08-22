---
id: 21-fingerprint-index-matcher
title: Fingerprint Index & Matcher
type: COMPONENT
path: Registry / Fingerprint Index
source_files: [packages/registry-tools/src/fingerprint.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: [20-cc10-honest-miss]
tags: [fingerprint, static-index, error-class, stack-shape, precision-first, static-pattern]
test_files: []
known_issues: []
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

- [ ] The index builds deterministically from a corpus's declared
      fingerprints (error class, message pattern, stack shape).
- [ ] An ambiguous input degrades to UNSTRUCTURED with named candidates
      (CC10 [20] property test).
- [ ] A synthetic cross-package collision fails the registry build with
      the colliding packages named.

## Dependencies

- [20-cc10-honest-miss](20-cc10-honest-miss.md)

## Known Issues

- [gap] The `static-pattern` fingerprint kind (matching source rather
  than runtime errors) is an open Wave-1 design question: who runs it
  (`wrap()`, lint integration, or both) is not yet decided.
