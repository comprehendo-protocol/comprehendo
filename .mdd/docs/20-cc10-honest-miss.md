---
id: 20-cc10-honest-miss
title: CC10 Honest Miss
type: SPEC
path: Core / Cross-Cutting Contracts / Honest Miss
source_files: []
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: []
tags: [fingerprint-ambiguity, unstructured, undocumented, property-test, honesty-about-coverage]
test_files: []
known_issues: []
---

# CC10 Honest Miss

## What to Build

A contract, not code: ambiguous fingerprint matches return UNSTRUCTURED
with candidates named, never a best guess. Unknown docs queries return
UNDOCUMENTED with did-you-mean, never an empty result or a wrong topic.
Property tests mutate cataloged error messages and assert honest
degradation rather than a wrong twin: a wrong twin is worse than no twin.

## Architecture

Enforced against Fingerprint Index & Matcher [21] (ambiguous match
handling) and Docs Engine [13] (query miss handling, already exercised in
Wave 2, re-verified here for the sidecar path).

## Implementation Notes

- "Candidates named" is the concrete shape of an honest ambiguous miss:
  UNSTRUCTURED does not just say "unknown," it says which cataloged
  fingerprints were close enough to be considered and rejected.
- Property testing is the enforcement mechanism, not example-based
  fixtures alone: mutate a known error message character by character (or
  field by field) and assert the matcher degrades to UNSTRUCTURED rather
  than confidently returning a nearby wrong twin.

## Data Model

N/A (a SPEC; UNSTRUCTURED and UNDOCUMENTED shapes are owned by Shape
Schemas [03]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- An ambiguous fingerprint match never resolves to a guessed twin; it
  resolves to UNSTRUCTURED with the ambiguous candidates named.
- A docs query with no confident match never returns an empty result or a
  wrong topic; it returns UNDOCUMENTED with did-you-mean.
- Precision beats recall throughout the router: a wrong twin is worse
  than no twin.

## Acceptance Criteria

- [ ] A property test mutating cataloged error messages asserts honest
      UNSTRUCTURED degradation, never a wrong twin.
- [ ] An ambiguous fingerprint match names its candidates in the
      UNSTRUCTURED response.
- [ ] A registry-corpus update that would create a cross-package
      fingerprint collision fails the registry build (Submission Gate
      [29]).

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
