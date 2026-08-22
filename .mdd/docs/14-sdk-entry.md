---
id: 14-sdk-entry
title: SDK Entry (makeProvider)
type: COMPONENT
path: Core / SDK Entry
source_files: [packages/core/src/sdk.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [11-marker-probe, 12-twin-builder, 13-docs-engine]
tags: [provider-sdk, makeProvider, native-adoption, level-1, level-2]
test_files: []
known_issues: []
primitives:
  - name: "makeProvider(corpus, hooks)"
    kind: function
  - name: "validate(input)"
    kind: function
  - name: "explain(input)"
    kind: function
---

# SDK Entry (makeProvider)

## What to Build

The single provider-side entry point: `makeProvider(corpus, hooks)` wires
a packed corpus, marker attachment, twin building, and the docs engine
into one object a package can export. This is what makes native adoption
"a dependency plus a corpus, never an implementation project": a
maintainer calls this once and gets the marker on their exports, twins at
their throw sites, and a working `docs()`. Must-not: never require a
maintainer to hand-wire the marker, twin building, or docs lookup
separately; those are what this entry point exists to collapse into one
call.

## Architecture

`packages/core/src/sdk.ts`. Composes Marker & Probe [11], Twin Builder
[12], and Docs Engine [13] into a single provider object. Consumed by
Manifest Wiring [15] (declares the resulting provider's manifest) and
Recorder [16] (optionally wraps the resulting provider's calls).

## Implementation Notes

- Conformance levels are decided here: Level 1 is twins plus docs plus
  identity, always present. Level 2 adds `validate`/`explain`, present
  only when `hooks` supplies the judge-without-executing logic; a
  provider that cannot judge without executing MUST omit `validate`
  rather than fake it (Shape Schemas [03]).
- This is the component the demo-state for Wave 2 targets directly: "a
  toy package built with the SDK passes the full kit."

## Data Model

`hooks` shape: `{ twinResolvers, validate?, explain? }`. The returned
provider object exposes the Level 1 (and optionally Level 2) surface from
the Protocol Surface table. `validate(input)`'s return shape is one of
`{valid: true}`, a twin (Shape Schemas [03]), or UNVALIDATABLE (`{query:
input, reason}`, meaning this specific input cannot be judged without
executing it). `explain(input)`'s return shape is `{ literalForm, notes
}`, the exact form `input` would execute as plus human-readable notes.

## API/Interface

- `makeProvider(corpus, hooks)`: returns a provider object with the
  marker attached, twins wired at declared throw sites, and `docs()`
  backed by the packed `corpus`.
- `validate(input)`: present on the returned provider only when `hooks`
  supplies judge-without-executing logic (Level 2). Judges `input`
  without running it; returns `{valid: true}` on a clean input, a twin on
  an input that would produce a cataloged failure, or UNVALIDATABLE when
  the provider cannot judge that particular input without executing it.
- `explain(input)`: present under the same Level 2 condition as
  `validate`. Returns the literal form `input` would execute as, plus
  human-readable notes, so a caller can inspect what would run before
  running it.

## Business Rules

- The returned provider always has marker, twins, and docs (Level 1
  minimum).
- `validate`/`explain` are present only when `hooks` supplies the logic to
  judge without executing; otherwise they are omitted, never stubbed to
  always return valid.
- The provider's manifest declaration (`{version, level}`) reflects the
  actual level achieved, computed from what `hooks` provided, not
  hand-set by the maintainer.

## Acceptance Criteria

- [ ] A toy package built with `makeProvider` passes the full kit: marker
      on export/errors/handles, twins at throw sites, UNSTRUCTURED
      passthrough, three-vocabulary docs, UNDOCUMENTED with a working
      miss log.
- [ ] `validate`/`explain` appear only when `hooks` supplies them; a
      provider without that support correctly reports Level 1.
- [ ] The toy package reaches Level 2 conformance in under one working
      day (Success Criterion 3), the native-adoption walkthrough baseline.

## Dependencies

- [11-marker-probe](11-marker-probe.md)
- [12-twin-builder](12-twin-builder.md)
- [13-docs-engine](13-docs-engine.md)

## Known Issues

None recorded at plan time.

## Interface Overview

`makeProvider` is the whole native-adoption story in one function call: a
package maintainer hands it a corpus and a few hooks, and gets back an
object with the marker, twins, and docs already wired, ready to export.

| Name | What it does |
|---|---|
| `makeProvider(corpus, hooks)` | Builds a Level 1 (or Level 2, with hooks) Comprehendo provider from a packed corpus. |
| `validate(input)` | Judges whether `input` would succeed, without running it. Level 2 only. |
| `explain(input)` | Shows the literal form `input` would execute as, plus notes. Level 2 only. |

### makeProvider(corpus, hooks)

Call this once, at your package's entry point, with your packed corpus and
whatever validation hooks you have. It returns an object carrying the
marker, throw-site twins, and a working `docs()`, ready to spread onto
your package's exports.

| Parameter | Values | Description |
|---|---|---|
| `corpus` | packed corpus artifact | Produced by Corpus Format's `pack()`. |
| `hooks` | `{ twinResolvers, validate?, explain? }` | `validate`/`explain` optional; omit if you cannot judge without executing. |

```js
export const provider = makeProvider(packedCorpus, {
  twinResolvers,
});
```

### validate(input)

Ask before you run it: pass whatever you're about to hand the provider,
and get back a judgment without any side effect. Only present when the
provider can genuinely judge without executing; if it cannot, this
function is simply absent rather than pretending to validate.

| Parameter | Values | Description |
|---|---|---|
| `input` | the same shape the provider's real call takes | The would-be call to judge, never executed. |

Returns `{valid: true}` (input is fine), a twin (input would produce a
cataloged failure), or UNVALIDATABLE (this specific input can't be judged
without running it).

```js
const result = provider.validate(input);
if (result.comprehendo) console.log(result.fixes[0].title);
```

### explain(input)

Shows exactly what would run, before it runs. Useful for a caller that
wants to inspect or log the real call form ahead of time, or double
-check a template-bound `apply` resolved the way they expected.

| Parameter | Values | Description |
|---|---|---|
| `input` | the same shape the provider's real call takes | The call to explain. |

Returns `{ literalForm, notes }`: the exact form `input` would execute
as, plus human-readable notes.

```js
const { literalForm, notes } = provider.explain(input);
```
