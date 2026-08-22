---
id: 12-twin-builder
title: Twin Builder
type: COMPONENT
path: Core / Twin Builder
source_files: [packages/core/src/twin.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [03-shape-schemas, 04-conformance-fixtures, 08-cc3-no-raw-errors, 09-cc7-schema-bound-fixes]
tags: [twin, unstructured, fix-validation, throw-site, apply-grammar, versioning]
test_files: []
known_issues: []
primitives:
  - name: "err.twin"
    kind: property
---

# Twin Builder

## What to Build

The twin construction path: builds a twin at the throw site from a
cataloged failure, attaches the marker (via Marker & Probe [11]), and
validates every `fixes[].apply` against the provider's declared call
schema at build time (a fix that would escape the schema fails the build,
not a runtime check). Wraps a novel, un-cataloged failure as UNSTRUCTURED
with the raw error preserved in `received`, never discarded. Must-not:
never surface a raw error as the primary message (CC3 [08]); never accept
a fix whose `apply` cannot be validated against the provider's schema
(CC7 [09]).

## Architecture

`packages/core/src/twin.ts`. Consumes Shape Schemas [03] for the twin/fix
shapes and Marker & Probe [11] to attach the marker. Used by SDK Entry
[14] (`makeProvider` wires a corpus's cataloged failures through this
builder) and by Router & Precedence [22] (the sidecar path calls the same
builder against a fingerprint-matched corpus entry).

## Implementation Notes

- Build-time fix validation is the load-bearing guarantee for CC7 [09]:
  `apply` parses against the provider's declared call schema or the build
  fails, never at runtime, never silently.
- The `apply` grammar is a Wave-1 open design question (literal code vs. a
  `template` form bound from fingerprint capture groups); this builder's
  validator must accept whichever form Wave 1 rules on.
- Versioning discipline binds this component directly: a published twin
  `code` never changes meaning across releases; `code` vocabularies belong
  to the provider, not to this shared builder.
- `fixes[]` is always ordered most-likely-first; the builder does not
  reorder fixes a corpus author has already ordered.

## Data Model

Twin: `{ comprehendo, code, reason, path?, namespace?, declared?,
received?, accepts?, fixes[] }` (Shape Schemas [03]). UNSTRUCTURED:
raw error preserved verbatim, wrapped with the same marker-discovery
surface so a caller can still probe it.

## API/Interface

- `err.twin`: attached to a thrown/raised error that matched a cataloged
  failure. Also reachable via the marker on the error itself.

## Business Rules

- Cataloged failure -> twin with `code`, `reason`, and at least one
  populated `fixes[]` entry.
- Un-cataloged failure -> UNSTRUCTURED, raw preserved, never a raw error
  as the primary surfaced value (CC3 [08]).
- Every `fixes[].apply` is validated against the provider's declared call
  schema at build time; validation failure fails the build.
- Every `fixes[].docs` pointer is checked against the corpus index; a
  dangling pointer fails the build (CC7 [09]).

## Acceptance Criteria

- [ ] Kit fixtures assert a twin on every cataloged failure.
- [ ] Kit fixtures assert UNSTRUCTURED wrapping (raw preserved in
      `received`) on every induced novel failure.
- [ ] A fix with a schema-escaping `apply` fails the build with the
      violation named.
- [ ] The negative kit's raw-leak and schema-escaping-fix fixtures fail
      their gates.

## Dependencies

- [03-shape-schemas](03-shape-schemas.md)
- [04-conformance-fixtures](04-conformance-fixtures.md)
- [08-cc3-no-raw-errors](08-cc3-no-raw-errors.md)
- [09-cc7-schema-bound-fixes](09-cc7-schema-bound-fixes.md)

## Known Issues

- [gap] The `apply` grammar (literal vs. `template`) is not yet ruled on;
  the fix validator's exact parsing rules depend on that Wave-1 decision.

## Interface Overview

Every error a Comprehendo-speaking provider throws for a cataloged failure
carries its own fix, right there on the error object. Instead of pattern
-matching a message string, an agent that catches the error reads
`err.twin` and gets a structured diagnosis plus at least one concrete,
schema-bound way to retry correctly.

| Name | What it does |
|---|---|
| `err.twin` | The structured twin attached to a thrown error for a cataloged failure. |

### err.twin

Present on any error a Comprehendo-speaking provider throws for a failure
it has catalogued. Carries a stable `code`, a human `reason`, and
`fixes[]` ordered most-likely-first, each fix either directly applicable
(`apply`) or a pointer into the docs (`docs`).

| Parameter | Values | Description |
|---|---|---|
| `code` | provider-defined string | Stable identifier; never changes meaning once published. |
| `fixes` | array of Fix | At least one entry has `apply` or `docs` set. |

```js
try {
  await client.query(badInput);
} catch (err) {
  if (err.twin) {
    const fix = err.twin.fixes[0];
    console.log(fix.title);
  }
}
```
