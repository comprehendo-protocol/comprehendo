---
id: 01-cc2-shape-identity
title: CC2 Shape Identity
type: SPEC
path: Spec / Cross-Cutting Contracts / Shape Identity
source_files: []
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-1
depends_on: []
tags: [conformance-kit, cross-language-parity, shape-schema, fixture, python-port]
test_files: []
known_issues: []
---

# CC2 Shape Identity

## What to Build

A contract, not code: every shape fixture (twin, fix, topic, index, entry,
UNDOCUMENTED, UNVALIDATABLE, manifest keys, config knobs) round-trips
byte-identically through both the TypeScript and Python implementations.
Field names are identical everywhere, in every language. A port requesting
a fixture change is a spec bug by definition, never a port bug: the spec
gets fixed first, the port never gets a special-cased fixture.

## Architecture

Enforced by the conformance kit (`@comprehendo/spec`), which both `comprehendo`
(npm) and `comprehendo` (PyPI) run from the identical fixture files, in
both CI matrices, from the same JSON on disk. No implementation owns this
contract; every implementation is judged by it.

## Implementation Notes

- The kit fixtures are the frozen contract: a fixture change is a breaking
  change and is rejected outside the deliberate spec-fix path.
- Byte-identical means literally byte-identical after canonical JSON
  serialization, not "semantically equivalent." Field order, key casing,
  and null-vs-absent all matter.
- This SPEC is introduced in Wave 1 (where Shape Schemas and Conformance
  Fixtures implement it for TypeScript) and proven again, cross-language,
  in Wave 3 when the Python port must pass with zero fixture changes.

## Data Model

N/A (this doc constrains the shapes; Shape Schemas [03] owns the shape
definitions themselves).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- A fixture change request from any port is treated as a spec bug: fix the
  spec (and the JSON Schema in `packages/spec/kit/shapes/`) first, then
  regenerate fixtures for every implementation together.
- Field names never differ across TypeScript and Python (no `snake_case`
  vs `camelCase` translation layer; the wire shape is identical).
- The kit runs in both CI matrices from the same fixture files: no
  language-local copies, no drift between "the TS fixtures" and "the Python
  fixtures."

## Acceptance Criteria

- [ ] Every shape fixture in `packages/spec/kit/fixtures/` round-trips
      byte-identically through both `comprehendo` (npm) and `comprehendo`
      (PyPI) serializers.
- [ ] CI runs the identical fixture files against both language matrices;
      a fixture file is never duplicated or forked per language.
- [ ] The Python port (Wave 3 exit gate) passes the kit with zero fixture
      changes.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
