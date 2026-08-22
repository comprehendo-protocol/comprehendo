---
id: 14-sdk-entry
title: SDK Entry (makeProvider)
type: COMPONENT
path: Core / SDK Entry
source_files: [packages/core/src/sdk.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [11-marker-probe, 12-twin-builder, 13-docs-engine]
tags: [provider-sdk, makeProvider, native-adoption, level-1, level-2]
test_files: [packages/core/test/sdk.test.ts, packages/core/test/sdk-toy-package.test.ts, packages/core/test/helpers/toy-provider.ts]
known_issues:
  - "[deferred] An UNSTRUCTURED twin raised through provider.raise(raw, context) carries the raw value in received and nothing else: unstructuredTwin(raw) in twin.ts (owned by 12-twin-builder) takes no context, and twin.ts is not this feature's file to change. The twin schema would permit path/namespace on an UNSTRUCTURED twin, so a throw site's own detail is dropped on the un-cataloged path only. Closing it is a one-argument change in 12."
  - "[deferred] makeProvider ships no default priming snippet: a copy of the RFC section 5.5 reference text in this package's source reads as a second Symbol.for('comprehendo') definition site to CC9 [10]'s source scan, which blanks comments but not string literals. priming is therefore a required hook. Shipping the canonical snippet as a constant belongs to Priming Snippet [36], which can either place it outside the scanned closure or teach the scan about string literals."
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
- Everything refusable is refused at construction: a packed corpus this
  runtime cannot read (13's `parsePackedCorpus`), a catalog that violates
  CC3/CC7 (12's `createTwinBuilder`), an empty identity or priming. A
  provider either exists whole or does not exist.
- The marker attached to the export, to every raised error, and to every
  controlled handle is ONE frozen entry object. This closes the
  integration point 12 left open: `attachTwin`'s `probeValue` defaults to
  a bare `true`, which `probe()` reads back as "no marker", so a twinned
  error only answers a probe when the SDK passes the real entry.

## Data Model

`hooks` shape, as built: `{ catalog, identity, priming, twinResolvers,
name?, validate?, explain?, docs? }`. The doc's original sketch named only
`{twinResolvers, validate?, explain?}`; `catalog` (the cataloged failures
plus the provider's declared call schema, Twin Builder [12]) and
`identity`/`priming` (required by the entry shape, Marker & Probe [11])
cannot come from a packed corpus, which carries neither, so they are
hooks too. `twinResolvers` are the declared throw sites: raw failure in,
`{code, context?}` out, `undefined` for "not mine", first claimant wins,
none means the failure passes through as UNSTRUCTURED.

Return shapes are the normative ones from `packages/spec/kit/shapes/`
(this section previously spelled two of them differently; the RFC wins,
per CLAUDE.md, see Fixed Issues):

- `validate(input)` returns `{valid: true}`, a twin (`twin.schema.json`),
  or UNVALIDATABLE (`unvalidatable.schema.json`): `{valid: null, code:
  "UNVALIDATABLE", reason}`, where `valid` is null because abstention is
  a refusal to give a verdict, not a verdict.
- `explain(input)` returns `explanation.schema.json`: `{would_execute,
  notes?}`, the literal form the input would execute as plus the defaults
  and rewrites applied.
- The provider also carries `manifest`, the `{version, level}` declaration
  Manifest Wiring [15] stamps into `package.json`, computed here.

A `validate` hook returns a VERDICT, not a finished response: `{valid:
true}`, `{code, context?}` naming a cataloged failure, or
`{unvalidatable: reason}`. The SDK builds the twin for the middle case
through the same catalog the throw sites use, so a twin from `validate`
is always CC7-checked and a hook naming an uncataloged code fails loudly
instead of shipping a fix no gate ever saw. An unreadable verdict raises;
defaulting to valid is the one answer a judge must never guess.

## API/Interface

- `makeProvider(corpus, hooks)`: returns a provider object with the
  marker attached, twins wired at declared throw sites, and `docs()`
  backed by the packed `corpus`. The object also carries `entry`,
  `manifest`, `level`, `surfaces`, the twin builder (`twins`), the
  throw-site helpers (`twinFor`, `errorFor`, `raise`), and `mark(handle)`
  for attaching the same entry to a controlled handle.
- `validate(input)`: present on the returned provider only when `hooks`
  supplies judge-without-executing logic (Level 2). Judges `input`
  without running it; returns `{valid: true}` on a clean input, a twin on
  an input that would produce a cataloged failure, or UNVALIDATABLE when
  the provider cannot judge that particular input without executing it.
- `explain(input)`: present under the same Level 2 condition as
  `validate`. Returns `{would_execute, notes?}`, the literal form `input`
  would execute as plus the defaults and rewrites applied, so a caller
  can inspect what would run before running it.

## Business Rules

- The returned provider always has marker, twins, and docs (Level 1
  minimum).
- `validate`/`explain` are present only when `hooks` supplies the logic to
  judge without executing; otherwise they are omitted, never stubbed to
  always return valid.
- The provider's manifest declaration (`{version, level}`) reflects the
  actual level achieved, computed from what `hooks` provided, not
  hand-set by the maintainer.
- Level 2 is the whole Level 2 SET: `level` is 2 only when `hooks`
  supplies both `validate` and `explain` (RFC section 3, "2 adds validate
  and explain"). A provider supplying just one gets that surface, listed
  in `entry.surfaces` because the list states what exists, and stays at
  level 1, because a consumer branching on `level` must not be told to
  call a surface that is not there.

## Acceptance Criteria

- [x] A toy package built with `makeProvider` passes the full kit: marker
      on export/errors/handles, twins at throw sites, UNSTRUCTURED
      passthrough, three-vocabulary docs, UNDOCUMENTED with a working
      miss log.
- [x] `validate`/`explain` appear only when `hooks` supplies them; a
      provider without that support correctly reports Level 1.
- [x] The toy package reaches Level 2 conformance in under one working
      day (Success Criterion 3), the native-adoption walkthrough baseline.
      (Demonstrated as "one build call plus hooks compiles and passes the
      kit", not literally timed; the walkthrough's real wall-clock
      baseline is Wave 7's cold-agent benchmark.)

## Dependencies

- [11-marker-probe](11-marker-probe.md)
- [12-twin-builder](12-twin-builder.md)
- [13-docs-engine](13-docs-engine.md)

## Known Issues

- [deferred] An UNSTRUCTURED twin raised through `provider.raise(raw,
  context)` carries the raw value in `received` and nothing else.
  `unstructuredTwin(raw)` (12's, and `twin.ts` is not this feature's file
  to change) takes no context, while the twin schema would permit `path`
  and `namespace` on an UNSTRUCTURED twin. Cataloged throw sites are
  unaffected; only the un-cataloged path drops the site's own detail.
  Closing it is a one-argument change in 12.
- [deferred] `makeProvider` ships no default priming snippet, so `priming`
  is a required hook. A copy of the RFC section 5.5 reference text in this
  package's source reads as a second `Symbol.for('comprehendo')`
  definition site to CC9 [10]'s scan, which blanks comments but not string
  literals, and dodging that scan by splitting the literal is exactly the
  evasion the negative kit's computed-marker fixture exists to catch.
  Shipping the canonical snippet belongs to Priming Snippet [36].

## Fixed Issues

### validate()/explain() hook returns were unguarded against non-objects (fixed 2026-08-22)

Found by review. `isClean`/`isAbstention`/`isResolution` used the bare
`in` operator on a `validate` hook's verdict with no guard that it was
even an object; `freezeExplanation` read `.notes` off an `explain`
hook's return the same way. `ValidationVerdict`/`Explanation` are
compile-time-only types: a hook returning `undefined` (a missing
`return` in one branch is a plausible authoring bug), `null`, or a
primitive threw a native `Cannot use 'in' operator...`/`Cannot read
properties of undefined` error instead of ever reaching this module's
own crafted, explanatory message, for exactly the malformed-hook case
that message exists to explain.

- Fixed by checking `typeof value === 'object' && value !== null`
  before any property access on either hook's return.
- Held by 9 new tests (5 verdict shapes x `validate`, 4 x `explain`),
  mutation-verified: removing either guard turns all of them red.

### Data Model spelled two response shapes the RFC does not use (fixed 2026-08-22)

Was: this section spelled `explain(input)`'s return as `{literalForm,
notes}` and UNVALIDATABLE as `{query: input, reason}`. Neither matches
`packages/spec/kit/shapes/explanation.schema.json` (`{would_execute,
notes?}`) or `unvalidatable.schema.json` (`{valid: null, code:
"UNVALIDATABLE", reason}`), and neither matches the kit's own `probe-hit`
transcript, which the spec suite validates.

- Fixed by correcting Data Model and API/Interface to the normative
  shapes, per CLAUDE.md's tiebreak ("where a doc and the RFC disagree, the
  RFC wins and the doc has a bug"), the same correction 13 made to its own
  Data Model. The acceptance suite asserts every produced response against
  the REQUIRED key list read out of the schema files themselves, so the
  code and the shapes cannot drift apart while still reading green.

### The `hooks` sketch could not build a provider (fixed 2026-08-22)

Was: `hooks` was described as `{twinResolvers, validate?, explain?}`,
which carries neither the twin catalog (a `ProviderCatalog` is what
`createTwinBuilder` gates on) nor `identity`/`priming` (which
`attachMarker` refuses an entry without), and a packed corpus carries
none of the three.

- Fixed by documenting the built shape, `{catalog, identity, priming,
  twinResolvers, name?, validate?, explain?, docs?}`, in Data Model. The
  three names the original sketch did give keep their exact meanings.

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
| `corpus` | packed corpus artifact | Your packed corpus, format version 1 (Docs Engine [13]); Corpus Generator [17] writes it. |
| `hooks` | `{ catalog, identity, priming, twinResolvers, name?, validate?, explain?, docs? }` | `catalog`, `identity`, `priming` and `twinResolvers` are required; `validate`/`explain` are optional, omit them if you cannot judge without executing. |

```js
export const provider = makeProvider(packedCorpus, {
  catalog,          // your cataloged failures and declared call surface
  identity,         // what this tool is, its completeness contract, its pointer
  priming,          // the snippet an agent is primed with, under 150 tokens
  twinResolvers: [  // your declared throw sites, in order
    (raw) =>
      String(raw).startsWith('Sort exceeded memory limit')
        ? { code: 'SORT_UNINDEXED_SPILL', context: { received: raw } }
        : undefined,
  ],
});

// at a throw site
throw provider.errorFor(rawDriverError);
// on a handle you hand out
return provider.mark(cursor);
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
cataloged failure), or `{valid: null, code: "UNVALIDATABLE", reason}`
(this specific input cannot be judged without running it).

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

Returns `{ would_execute, notes }`: the exact form `input` would execute
as, plus human-readable notes on the defaults and rewrites applied.

```js
const { would_execute, notes } = provider.explain(input);
```
