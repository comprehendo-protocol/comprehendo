---
id: 10-cc9-marker-freeze
title: CC9 Marker Freeze
type: SPEC
path: Core / Cross-Cutting Contracts / Marker Freeze
source_files: []
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: []
tags: [marker, frozen-literal, symbol, dunder, grep-lint, release-gate]
test_files: []
known_issues: []
---

# CC9 Marker Freeze

## What to Build

A contract, not code: `Symbol.for('comprehendo')` (JavaScript) and
`__comprehendo__` (Python) appear as frozen literals exactly once per
implementation, never computed, never aliased. The manifest keys carry the
same freeze. Enforced by a scan plus a grep-level lint in both repos.

## Architecture

Enforced against Marker & Probe [11] (the JS marker literal) and the
Wave-3 Python Core [18] (the `__comprehendo__` literal). Re-verified as
part of the Wave 7 release gate alongside the finalized priming snippet
and `COMPREHENDO.md` generation.

## Implementation Notes

- "Exactly once per implementation" means one source-of-truth constant, not
  one string that happens to appear once by accident; every other usage
  imports that constant, never re-literals it.
- "Never computed" rules out `Symbol.for(someTemplate())` or any string
  concatenation that produces the marker value; the negative kit's
  computed-marker fixture (Negative Fixtures [05]) exists to catch exactly
  this.

## Data Model

N/A (a SPEC; the marker constant itself is owned by Marker & Probe [11]
and Python Core [18]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- `Symbol.for('comprehendo')` is defined once in `packages/core/src/marker.ts`
  and imported everywhere else it is referenced.
- `__comprehendo__` is defined once in the Python port's marker module and
  imported everywhere else.
- Manifest key names (`comprehendo` in package.json,
  `[tool.comprehendo]` in pyproject.toml) are likewise frozen literals.

## Acceptance Criteria

- [ ] A grep-level lint in both repos finds exactly one definition site
      for each marker literal.
- [ ] The negative kit's computed-marker fixture fails its gate.
- [ ] Wave 7's release gate re-runs this scan and passes.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
