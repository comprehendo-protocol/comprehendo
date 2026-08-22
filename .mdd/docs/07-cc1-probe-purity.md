---
id: 07-cc1-probe-purity
title: CC1 Probe Purity
type: SPEC
path: Core / Cross-Cutting Contracts / Probe Purity
source_files: []
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: []
tags: [probe, marker, side-effect-free, scan, ci-gate]
test_files: []
known_issues: []
---

# CC1 Probe Purity

## What to Build

A contract, not code: probing the marker performs no I/O, mutates nothing,
and allocates only the entry object itself. Enforced two ways: a static
scan of marker modules for imports of `fs`, `net`, `http`, `dns`, and
`child_process` (there must be none in core at all), and a runtime test
that probes a provider ten thousand times and asserts identical results
and no observable side effects.

## Architecture

Enforced against Marker & Probe [11], the only component that implements
the probe surface. The scan runs at CI over `packages/core/src/marker.ts`
(and any module it imports); the runtime test drives the built package.

## Implementation Notes

- "No I/O" includes no filesystem reads for the probe path itself; loading
  a packed corpus is a Docs Engine [13] concern, not the marker probe's.
- Ten-thousand-probe repeatability is the concrete bar: any observable
  drift (different result, a side effect, growing memory beyond the single
  entry allocation) is a CC1 violation.

## Data Model

N/A (a SPEC; the probe itself returns a boolean/entry shape owned by
Marker & Probe [11]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- Marker modules import none of: `fs`, `net`, `http`, `dns`,
  `child_process`. The scan checks the whole core package, not just the
  marker file, because a transitive import defeats the guarantee.
- Probing is idempotent: identical input, identical output, every time,
  with no accumulated state.

## Acceptance Criteria

- [ ] CI scan of core finds zero imports of `fs`/`net`/`http`/`dns`/`child_process`.
- [ ] A 10,000-iteration probe test asserts identical results and zero
      observable side effects.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
