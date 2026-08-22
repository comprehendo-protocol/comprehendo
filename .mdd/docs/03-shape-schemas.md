---
id: 03-shape-schemas
title: Shape Schemas
type: COMPONENT
path: Spec / Shape Schemas
source_files: [packages/spec/kit/shapes/]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-1
depends_on: [01-cc2-shape-identity]
tags: [json-schema, twin, fix, topic-shape, manifest-keys, config-knobs, versioning]
test_files: [packages/spec/test/shape-set.test.mjs, packages/spec/test/rfc-examples.test.mjs, packages/spec/test/error-shapes.test.mjs, packages/spec/test/docs-shapes.test.mjs, packages/spec/test/judgment-shapes.test.mjs, packages/spec/test/discovery-shapes.test.mjs, packages/spec/test/forward-compat.test.mjs]
known_issues: [{type: deferred, note: "packages/spec uses node --test plus ajv instead of the CLAUDE.md-documented Vitest, a deliberate call for this zero-runtime-dependency data package; reconsider once Wave 2 packages with real runtime code land, they should very likely use Vitest per the documented stack"}]
---

# Shape Schemas

## What to Build

A JSON Schema per normative shape in the RFC: twin, fix, topic, index,
entry, UNDOCUMENTED, UNVALIDATABLE, the `explain(input)` response, manifest
keys, and the five consumer config knobs. (This list originally omitted
`explain`'s response shape; the Business Rules line below already required
one schema per Protocol Surface table row, and `explain` is a row in that
table, so the build added `explanation.schema.json` and this line is
corrected to match, rather than the RFC being narrowed to match a short
list.) Each schema is the machine-checkable definition that
Conformance Fixtures [04] and Negative Fixtures [05] are validated against.
Must-not: no schema invents a field the RFC does not define; no schema
narrows a field's allowed shape below what the RFC allows (that narrowing,
if ever needed, is a documented `Scope decision` line, not a silent
schema edit).

## Architecture

Lives in `packages/spec/kit/shapes/`, one JSON Schema file per shape. Spec
depends on nothing (`spec -> nothing (it is data)`); every other package
depends on spec, never the reverse. `@comprehendo/registry-tools`,
`comprehendo` (npm), and `comprehendo` (PyPI) all validate against these
schemas, never against a hand-rolled local copy.

## Implementation Notes

- The twin shape: `{ comprehendo, code, reason, path?, namespace?,
  declared?, received?, accepts?, fixes[] }`.
- The fix shape: `{ title, apply? (schema-bound), docs? (corpus topic),
  confidence? }`, with the rule that at least one of `apply` or `docs` is
  required, and `fixes[]` is ordered most-likely-first.
- Conformance levels are part of this shape set: Level 1 is twins plus
  docs plus identity; Level 2 adds `validate` and `explain`. A provider
  that cannot judge without executing MUST omit `validate` rather than
  fake it (this is a schema-level constraint: `validate` is optional, not
  nullable-but-always-present).
- Versioning discipline (RFC §11, binding on this schema set): the spec is
  semver'd; within a major, fields are only ever added, never removed or
  re-typed; agents and implementations MUST ignore fields they do not
  recognize; a published twin `code` never changes meaning. The
  forward-compat fixture in Conformance Fixtures [04] exercises this
  directly against these schemas.

## Data Model

- **Twin**: `comprehendo` (marker/identity field), `code` (provider-owned
  vocabulary, stable), `reason` (human string), `path?`, `namespace?`,
  `declared?`, `received?`, `accepts?`, `fixes[]` (Fix[]).
- **Fix**: `title` (string), `apply?` (schema-bound call form), `docs?`
  (corpus topic pointer), `confidence?` (number/enum).
- **Topic / Index / Entry**: the docs-engine response shapes (index: names
  only; topic: one answer; entry: a single corpus record).
- **UNDOCUMENTED / UNVALIDATABLE**: sentinel response shapes for the honest
  -miss paths (see CC10 [20]).
- **Manifest keys**: provider-side `{version, level}`.
- **Config knobs**: consumer-side `prefer`, `pin`, `disable`, `require`,
  `local`.

## API/Interface

N/A at this layer (schemas are data definitions, not runtime exports; the
runtime surfaces that use them are documented on Twin Builder [12], Docs
Engine [13], and Router & Precedence [22]).

## Business Rules

- Every schema file corresponds 1:1 to a shape named in the RFC's Protocol
  Surface table; no schema exists that the RFC does not name, and no named
  shape lacks a schema.
- `fixes[]` must contain at least one entry with `apply` or `docs` set;
  a fix with neither is not a conforming fix.
- Fields are additive-only within a major version (never removed, never
  re-typed).

## Acceptance Criteria

- [x] Every shape named in the RFC's Protocol Surface table has a
      corresponding JSON Schema file in `packages/spec/kit/shapes/`.
- [x] Every schema validates the RFC's own worked examples (from
      `comprehendo-spec.md`) without modification.
- [x] The forward-compat fixture (a twin carrying unknown fields) validates
      successfully against the twin schema, proving the schema does not
      reject additive future fields.

## Dependencies

- [01-cc2-shape-identity](01-cc2-shape-identity.md) (SPEC this component
  satisfies: identical shapes across languages).

## Known Issues

- [deferred] `packages/spec` uses `node --test` plus `ajv` rather than the
  CLAUDE.md-documented Vitest. Deliberate for this zero-runtime-dependency
  data package (Vitest would add roughly 100 transitive dependencies to a
  package whose stated architecture is "depends on nothing, it is data").
  Reconsider once Wave 2 packages with real runtime code land; they should
  very likely use Vitest per the documented stack.
