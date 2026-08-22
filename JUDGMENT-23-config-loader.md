# JUDGMENT, 23-config-loader

Decide-and-log calls made while building the consumer-side config loader.
Anything blocking stops instead, per the plan-execute judgment protocol.

## 1. The consumer half is a NEW file, `packages/core/src/config-consumer.ts`

`packages/core/src/config.ts` is already 415 lines when this build starts (15's
provider-side manifest half), past this project's 400-line ceiling. Adding the
five knobs there would have pushed it past 600. Same split 12/13/17/21/22 made
at this gate. The new module is PURE (no `node:` import at all), which is what
lets `router-precedence.ts` import it as a value without breaking the routing
modules' no-I/O scan (`router-comprehend.test.ts`).

`config.ts` gains exactly two things, both minimal: `export * from
'./config-consumer.js'` (so the module surface stays one import, as the lane
plan asked) and `readConsumerConfigFile(path)`, which needs `MANIFEST_KEY` and
`readHost`, both of which live there and cannot be duplicated (CC9 [10]: one
definition site for the manifest key, asserted by `config-cc8.test.ts`).
`source_files` updated to name both files plus the router modules. Final line
counts: `config-consumer.ts` 202, `config.ts` 442 (it was 415 before this
build, already past the ceiling; the +27 is `readConsumerConfigFile` and the
re-export, and no line of 15's code was touched). Flagged for the orchestrator
rather than fixed here: splitting 15's half is 15's call, not this lane's.

## 2. Doc 23's `prefer?: string[]` is a doc bug; the kit's shape wins

`.mdd/docs/23-config-loader.md`'s Data Model spells `prefer` as `string[]`. The
conformance kit's `config.schema.json` (RFC §10.5, the normative source, and
CLAUDE.md's "where a doc and the RFC disagree, the RFC wins") spells it as an
object of package -> tier string, and 22 already shipped
`prefer?: Record<string, string>` against it. All five knobs are implemented to
the kit's schema, and a test asserts the parsed knob set IS the schema's
property set, so a future schema change cannot pass silently.

## 3. `require`: the trust ladder is real, the trust DATA is Wave 5's

Nothing populates real trust levels until Owner Endorsement [30] (Wave 5), so
no trust data is faked here. What exists:

- `TRUST_LEVELS` (community < endorsed < native), the ladder itself, frozen.
- `InstalledCorpus.trust?: TrustLevel`, the slot [30] fills. Absent means
  `community`, which is exactly what an unendorsed registry corpus is today.
- The router expresses "this corpus does not meet the required trust level" as
  a decision (`source: 'none'`, `knob: 'require'`, the reason naming both
  levels), and REFUSES to route rather than answering from a corpus the
  consumer said was not good enough. Fail closed, because the alternative is
  answering from an unendorsed corpus while the consumer asked for endorsed.
- The `native` rung is fully live today: `require: {pkg: 'native'}` is
  satisfied by real discovery (marker or manifest) and unsatisfied without one.
- So `require: {pkg: 'endorsed'}` refuses every corpus until [30] ships. That
  is the honest state of the ladder, not a placeholder: a test asserts a corpus
  that DOES declare `trust: 'endorsed'` satisfies it, so [30] wires data, not
  logic.

## 4. `pin` scope: version identity, fail closed

Multi-version corpus support does not exist (one installed corpus per package,
Wave 5's Corpus Format [28] owns the published format). The smallest real
implementation: the decision compares the pinned version against the installed
corpus's own `version` and refuses to route when they differ, when the corpus
is not installed, or when it reports no version at all. Keys are matched by
corpus package name first (`@comprehendo/ffmpeg`, the kit's spelling) and then
by target package name, because the doc says "locks a package" and the schema
says "keys are corpus package names"; accepting both costs one lookup and
removes a foot-gun.

## 5. `disable` outranks every other knob, including native

"Turns off Comprehendo routing for a specific package entirely" is read
literally: `decideFor` reports `source: 'none'`, `comprehend(raw)` returns the
honest UNSTRUCTURED passthrough instead of any twin (never the sidecar's, never
a carried one, so the knob's effect is unambiguous), and `docs(pkg, query)`
returns UNDOCUMENTED with source permitted. Nothing is thrown and nothing is
returned raw: CLAUDE.md's "every error is twinned or honestly marked
UNSTRUCTURED, never raw" still holds.

## 6. `local` reuses 17's corpus convention and 22's ONE index

A `local` path is a directory carrying the same artifacts an installed corpus
package ships (`comprehendo.packed.json` from `comprehendo pack`, plus the
fingerprint and twin artifacts), so `comprehendo init/scan/pack` serves a
private corpus with no second code path, exactly as 17's doc says. Mounting
happens inside `discoverInstalledCorpora` (`router-discovery.ts`, 22's file,
complete, and owned by no concurrent lane) rather than in a new loader of mine,
for one hard reason: 22 compiles ONE fingerprint index over every corpus so a
fingerprint two corpora both claim is visible as an ambiguity (CC10 [20]). A
separate local index would resolve that silently by load order. A test asserts
the ambiguity is visible across the local/installed boundary.

Local corpora carry no trust level (so `community`, the same default as an
unendorsed registry corpus). Inventing a rung for "the consumer wrote it
themselves" would be fabricating exactly the trust data call 3 refuses to fake.

## 6b. `router-discovery.ts` was edited, and it was not in the lane's named list

The lane plan named `config.ts`, `router.ts` and `router-precedence.ts`. The
`local` mount needs the discovery adapter, and the alternative (a second corpus
loader and a second fingerprint index in a file of mine) would have broken the
one-index property CC10 rests on. Taken as a small call rather than a blocker
because the file belongs to 22, which is COMPLETE and merged, and no concurrent
lane touches it (24 owns `wrap.ts`). Flagged here so the orchestrator sees it.

## 6c. One Red-Gate test was rewritten, once, for a contract it had wrong

`router-local-corpus.test.ts` first asserted that a private corpus declaring
the IDENTICAL fingerprint of a public one surfaces as an ambiguity. It does
not: 21's index refuses to BUILD on identical fingerprints, and 22 deliberately
does not catch that refusal. The doc's rule ("collisions stay visible") is
satisfied by both behaviors, so the suite now asserts both, the overlapping
pattern as an ambiguity and the identical one as a loud refusal. The
implementation was not bent to the test.

## 7. `RouteSource` gains `'none'`, `RouterDecision` gains `knob`

Three knobs (`disable`, `require`, `pin`) can decide that NO tier answers, and
`'sidecar'` would be a lie for all three. `knob` names which consumer knob
decided the route (absent means default precedence), which is what makes "each
knob demonstrably changes routing" assertable instead of inferred from prose.
24-wrap-proxy builds against `RouterConfig` concurrently; the widening is
additive (`RouterConfig` is now exactly `ConsumerConfig`, whose only previous
member `prefer` is unchanged), and the orchestrator owns any merge friction.

## 8. Consumer config is read from package.json only

`readConsumerConfigFile` reads the `comprehendo` key of a package.json. A
consumer's `pyproject.toml` would need nested tables
(`[tool.comprehendo.prefer]`), which 15's deliberately line-oriented reader
does not do and which is the Python port's surface anyway; the call refuses
loudly with `ManifestError` naming the limitation rather than reporting an
absent config for a project that configured one. Same honesty rule 15 applied
to the inline-table spelling.
