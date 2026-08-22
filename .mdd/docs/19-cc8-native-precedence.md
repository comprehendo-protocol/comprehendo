---
id: 19-cc8-native-precedence
title: CC8 Native Precedence
type: SPEC
path: Core / Cross-Cutting Contracts / Native Precedence
source_files: []
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: []
tags: [precedence, native-vs-sidecar, prefer-knob, no-veto, scan]
test_files: []
known_issues: []
---

# CC8 Native Precedence

## What to Build

A contract, not code: with both a native implementation and a registry
corpus present for the same package, the router provably defers to
native. The consumer `prefer` knob provably reverses that per package. No
provider-side mechanism can suppress a registry corpus at all, in either
direction, which is scanned for directly: the provider manifest schema
(Manifest Wiring [15]) contains no such field.

## Architecture

Enforced against Router & Precedence [22] (the precedence decision itself)
and Manifest Wiring [15] (the scan that proves no suppression field
exists). This is the DefinitelyTyped analogy made concrete: bundled types
supersede `@types/*` automatically, and the same mechanical default
applies here.

## Implementation Notes

- "Provably" means a kit fixture exercises both directions: native
  present + no `prefer` override -> native wins; native present +
  `prefer: sidecar` for that package -> sidecar wins.
- The no-veto guarantee is structural, not policy: it is impossible for a
  provider manifest to express suppression, because the schema (Manifest
  Wiring [15]) has no field for it. This is stronger than "providers are
  asked not to."

## Data Model

N/A (a SPEC; the manifest and router decision shapes are owned by
Manifest Wiring [15] and Router & Precedence [22]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- Default precedence: native beats sidecar, always, with no provider-side
  override possible.
- The `prefer` config knob (consumer-side, Config Loader [23]) is the
  only mechanism that can reverse precedence, and it acts per package.
- A provider manifest schema containing any suppression-shaped field is a
  CC8 violation on its own, independent of runtime behavior.

## Acceptance Criteria

- [x] A kit fixture proves native wins by default when both are present:
      Router & Precedence [22]'s `router-installed.test.ts`, "installing
      the native toy flips precedence" (a real native package, no
      config), and the negative kit fixture
      `packages/spec/kit/negative/provider-side-corpus-veto.json`.
- [x] A kit fixture proves `prefer` reverses precedence per package:
      same suite, "prefer sidecar still routes the natively installed
      toy to the sidecar" (Config Loader [23]'s `router-knobs.test.ts`
      exercises every other package, unaffected, alongside it).
- [x] A schema scan of the manifest (Manifest Wiring [15]) finds no
      suppression-capable field: `config-cc8.test.ts`, "the
      provider-side manifest schema has no suppression field" (scans a
      real schema, asserts exactly the two written fields and no
      third, shares no name with the five consumer-side knobs).

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
