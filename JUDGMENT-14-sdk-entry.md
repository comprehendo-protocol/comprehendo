# Judgment log, 14-sdk-entry

Decide-and-log calls made while building `makeProvider`. Blocking items are
not here; they stop the build and go back to the orchestrator.

## 1. `explain()` returns `{would_execute, notes}`, not the doc's `{literalForm, notes}`

The feature doc's Data Model and API/Interface sections spell the explain
response `{ literalForm, notes }` and UNVALIDATABLE as `{query: input,
reason}`. The normative shapes shipped in `packages/spec/kit/shapes/` say
otherwise: `explanation.schema.json` requires `would_execute` (with optional
`notes[]`), and `unvalidatable.schema.json` requires `{valid: null, code:
"UNVALIDATABLE", reason}`. The kit's `probe-hit` transcript uses those exact
shapes, and the spec suite validates the RFC's own worked examples against
them.

CLAUDE.md settles this explicitly: "where a doc and the RFC disagree, the RFC
wins and the doc has a bug". Implemented the schema shapes; the acceptance
suite asserts the produced objects against the required-key lists read out of
the schema files themselves, so the two cannot drift. Doc 13 made the same
correction to its own Data Model section (its "Fixed Issues" section), so
this is the established precedent in this wave, not a new call.

## 2. Level 2 means BOTH `validate` and `explain`; one alone is Level 1 plus a surface

RFC section 3 (as carried by `entry.schema.json` and doc 03): "1 is twins
plus docs plus identity; 2 adds validate and explain". A provider that
supplies only one of the two hooks gets that surface exposed and listed in
`entry.surfaces` (the schema's `surfaces` is "a statement of what exists"),
but the computed `level` stays 1, because the level is a claim about the
whole Level 2 set. The alternative, calling a validate-only provider Level 2,
would let a consumer that branches on `level` call an `explain` that is not
there.

## 3. Hooks carry the catalog and identity, which the doc's `{twinResolvers,
validate?, explain?}` sketch does not name

The doc's hooks sketch is abbreviated: a twin builder needs a
`ProviderCatalog` (declared call schema, corpus topics, cataloged entries)
and `attachMarker` refuses an entry without `identity`, and neither can come
from the packed corpus (format v1 carries no catalog and no identity). Added
`catalog` and `identity` as required hook fields, `name`, `priming` and
`docs` as optional ones. `twinResolvers`, `validate` and `explain` keep the
doc's names and meanings exactly.

`twinResolvers` is read as the declared-throw-site resolvers: raw failure in,
cataloged `{code, context?}` out, `undefined` for "not mine". First claimant
wins, none means the failure passes through as UNSTRUCTURED.

## 4. `identity` and `priming` are both required hooks, and there is NO default priming snippet

Both are the provider's own claim about itself, both are required by the
entry shape 11 validates, and an empty one is refused at construction rather
than shipping an entry no agent can orient from.

The first attempt DID ship a default: `DEFAULT_PRIMING`, the RFC section 5.5
reference snippet copied verbatim from the kit's measured fixture, with a
drift test and a CC5 budget test. The full-suite run caught it, and the catch
is worth recording. The snippet's own prose names the marker,
"probe the handle or caught error for the marker (Symbol dot for
('comprehendo') in JS...)", and CC9 [10]'s one-definition-site scan
(`findMarkerCalls` in `test/helpers/source-scan.ts`) blanks COMMENTS but not
STRING LITERALS, so a copy of that sentence in `src/sdk.ts` is a second
definition site as far as the gate can see, and `marker-freeze.test.ts` went
red on exactly that.

Three ways out were considered:
- Split the literal so the scan cannot see `Symbol.for(` contiguously.
  Rejected: dodging a conformance scan by string surgery is the negative
  kit's own computed-marker anti-pattern, and it would leave the gate green
  while blind.
- Teach the scan about string literals. That is the correct long-term fix,
  but `source-scan.ts` and `marker-freeze.test.ts` belong to 11-marker-probe,
  not to this lane, so touching them here is out of bounds.
- Make `priming` a required hook and carry no reference text in this
  package's source at all. Taken. It costs one line of adoption ergonomics,
  it keeps CC9's scan honest, and it puts the canonical snippet where the doc
  set already puts it: Priming Snippet [36]. The toy package in the tests
  reads the snippet from the kit fixture, so the CC5 budget assertion (with a
  token floor, so an empty snippet cannot pass vacuously) still runs and
  nothing is duplicated anywhere.

Recorded in the feature doc's known issues as `[deferred]`, with what closing
it needs.

## 5. `validate` hooks name a cataloged code; they never hand back a twin

A `validate` verdict is one of `{valid: true}`, `{code, context?}`, or
`{unvalidatable: reason}`. The SDK builds the twin for the middle case
through the same twin builder the throw sites use, so a twin returned from
`validate` is always catalog-backed and CC7-checked, and a hook naming a code
the catalog does not carry fails loudly (`TwinCatalogError`) instead of
producing a hand-rolled twin that no gate ever saw. An unreadable verdict
shape raises rather than defaulting to valid: defaulting to valid is the one
answer a judge must never guess.

## 6. An UNSTRUCTURED twin gets no throw-site context

`unstructuredTwin(raw)` from 12 takes only the raw value, and `twin.ts` is
not this feature's file to change. So `provider.raise(raw, context)` applies
`context` only when a resolver placed the failure in the catalog; an
unresolved failure carries the raw value in `received` and nothing else. The
twin schema would permit `path` on an UNSTRUCTURED twin, so this is a real
(small) gap, recorded in the feature doc's known issues as `[deferred]`
rather than worked around by re-implementing 12's constructor here.

## 7. The entry's `comprehendo` version comes from the runtime, not the corpus

Both the packed corpus and the SDK declare a spec version. The entry and the
manifest carry `SPEC_VERSION` from `twin.ts`, which is what this
implementation actually implements; the corpus's own `comprehendo` field is
left to the corpus. A mismatch is not refused here, because refusing would
narrow a rule no doc states, and the packed-corpus loader (13) already owns
what this runtime can read via the `packed` format version.

## 8. `packages/core/src/index.ts` addition kept to one line of re-export

The orchestrator's lane note allows this feature to fill the empty barrel,
and sibling lanes 15/16 may touch the same file. The addition is exactly one
`export * from './sdk.js'`-shaped statement naming `makeProvider` and the
types tied to it, with the existing comment left in place, so a sibling lane
adds its own line next to it instead of resolving a restructure.
