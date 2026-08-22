---
id: 08-cc3-no-raw-errors
title: CC3 No Raw Errors
type: SPEC
path: Core / Cross-Cutting Contracts / No Raw Errors
source_files: []
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: []
tags: [twin, unstructured, primary-error, honesty-about-coverage]
test_files: []
known_issues: []
---

# CC3 No Raw Errors

## What to Build

A contract, not code: a conforming provider never surfaces a raw error as
the primary message. A cataloged failure comes back as a twin; a novel,
un-cataloged failure comes back UNSTRUCTURED, with the raw error preserved
verbatim in `received`, never discarded and never presented as the primary
answer.

## Architecture

Enforced against Twin Builder [12], which owns the raw-to-twin and
raw-to-UNSTRUCTURED transforms. The negative kit's raw-leak fixture
(Negative Fixtures [05]) is this contract's must-fail proof: a build where
that fixture passes its gate is a CC3 violation.

## Implementation Notes

- UNSTRUCTURED is not a failure mode of the twin builder, it is a
  documented, honest outcome: "this is real, we do not have a catalog
  entry for it yet, here is the raw error so you are not blind."
- The raw error is never lost. It moves into `received` (or the
  UNSTRUCTURED wrapper's equivalent field), it is simply never the
  PRIMARY surfaced message.

## Data Model

N/A (a SPEC; the twin and UNSTRUCTURED shapes are owned by Shape Schemas
[03]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- Cataloged failure -> twin, `code` from the provider's vocabulary,
  `fixes[]` populated.
- Un-cataloged failure -> UNSTRUCTURED, raw preserved in `received`, never
  silently dropped.
- Nothing in the twin-builder call path throws or returns a bare native
  error object as the outward-facing result.

## Acceptance Criteria

- [ ] Kit fixtures assert a twin on every cataloged failure and
      UNSTRUCTURED wrapping (raw preserved) on every induced novel
      failure.
- [ ] The negative kit's raw-leak fixture fails its gate (CI red if it
      instead passes).

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
