---
id: 23-config-loader
title: Config Loader
type: COMPONENT
path: Core / Config Loader
source_files: [packages/core/src/config-consumer.ts, packages/core/src/config.ts, packages/core/src/router-precedence.ts, packages/core/src/router.ts, packages/core/src/router-discovery.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: [22-router-precedence]
tags: [config-knob, prefer, pin, disable, require, local, consumer-side]
test_files: [packages/core/test/config-consumer.test.ts, packages/core/test/router-knobs.test.ts, packages/core/test/router-local-corpus.test.ts]
known_issues:
  - "[deferred] The consumer half lives in packages/core/src/config-consumer.ts, not config.ts: 15's provider-side half already put that file past the 400-line ceiling, and the routing modules import these helpers as values, which only a module with no node: import can supply. config.ts re-exports it, so the module surface is one import. JUDGMENT-23-config-loader.md call 1."
  - "[deferred] No trust DATA exists until Owner Endorsement [30] (Wave 5). The ladder, the InstalledCorpus.trust slot and the refusal are wired and tested; absent means community, so require: endorsed refuses every registry corpus today, which is the honest state of the ladder, not a stub. The native rung is fully live. JUDGMENT call 3."
  - "[deferred] pin compares against the ONE installed corpus's version and refuses when it differs, is absent, or reports no version. Multi-version corpus support does not exist (Corpus Format [28], Wave 5 owns the published format), so pin cannot select a different version, only refuse the wrong one. JUDGMENT call 4."
  - "[deferred] Consumer knobs are read from package.json only. A consumer pyproject.toml needs nested tables ([tool.comprehendo.prefer]), which 15's line-oriented reader does not do and which is the Python port's surface; readConsumerConfigFile refuses it by name rather than reporting no configuration. JUDGMENT call 8."
  - "[deferred] The doc's Data Model spelled prefer as string[]. The kit's config.schema.json (RFC 10.5) spells it as an object, 22 shipped it that way, and the RFC wins where a doc disagrees. Data Model below corrected; a test asserts the parsed knob set IS the schema's property set. JUDGMENT call 2."
  - "[gap] A local corpus carries no trust level, so it reads as community: require: {internal-pkg: endorsed} refuses a corpus the consuming org wrote itself. Inventing a rung for it would be fabricating exactly the trust data this build refuses to fake; revisit when [30] defines what endorsement means for a private corpus."
  - "[deferred] 12 of the 58 new tests were green at the Red Gate by design and are recorded as controls, not new coverage: the guards on behavior 22 and 15 already shipped (prefer reversing precedence, the provider-side two-field projection) and the negative cases (knob set for another package leaves this one routing), which have to be green before AND after. The other 46 were red."
---

# Config Loader

## What to Build

The consumer-side config loader: reads the five knobs (`prefer`, `pin`,
`disable`, `require`, `local`) from the consuming project's own manifest
and feeds them into Router & Precedence [22]'s routing decision. These
knobs belong to the consuming project, never to a provider (CC8 [19]).
Must-not: a provider manifest field can never express any of these five
knobs on the consumer's behalf.

## Architecture

`packages/core/src/config-consumer.ts` is the consumer-side half: the knob
shape, the trust ladder, the parse, and the pure predicates the router asks
(`isDisabled`, `pinnedVersion`, `demandedTrust`, `localCorpusPath`,
`meetsTrust`). It imports no `node:` module, which is what lets
`router-precedence.ts` import it as a value without breaking the routing
modules' no-I/O scan. `packages/core/src/config.ts` (Manifest Wiring [15]'s
provider-side half) re-exports it, so the module surface is one import, and
owns `readConsumerConfigFile`, the one function that touches disk, because
the manifest key has exactly one definition site there (CC9 [10]).

The knobs reach routing through three seams already built by 22:
`RouterConfig` (now exactly `ConsumerConfig`) is read per call by
`decideRoute`, `createRouter` hands it every decision, and
`discoverInstalledCorpora` reads `local` (the one knob that changes what
EXISTS rather than which tier answers) so a private corpus joins the same
fingerprint index every installed corpus is compiled into.

## Implementation Notes

- The knobs are read in a stated order, so two set at once is not a coin
  toss: `disable`, then `prefer`, then `require`, then `pin`, then `local`.
  `RouterDecision.knob` names the knob that decided, and `RouteSource` has a
  third value, `none`, because three knobs can answer that NO tier routes.
- `prefer`: reverses native-vs-sidecar precedence per package. Built by
  Router & Precedence [22] and reused unchanged, not reimplemented.
- `pin`: refuses to route when the installed corpus is not the pinned
  version, reports no version, or is not installed. Keyed by corpus package
  name first, then target package name.
- `disable`: outranks every other knob including native. `comprehend(raw)`
  answers the honest UNSTRUCTURED passthrough (never the corpus that was
  ruled out, never a twin the value happened to carry) and `docs(pkg, query)`
  answers UNDOCUMENTED with source permitted.
- `require`: reads the corpus's rung off `InstalledCorpus.trust`, the slot
  Owner Endorsement [30] (Wave 5) fills. No trust data is invented: absent
  means `community`, `native` is satisfied by real discovery today, and a
  demand nothing can meet refuses rather than answering from a corpus the
  consumer said was not good enough. A value off the ladder is reported at
  parse time and refuses at route time.
- `local`: mounts a private corpus for an internal package through the same
  loader an installed corpus package goes through, so Corpus Generator [17]
  serves it with no second code path, and into the SAME fingerprint index,
  so a private corpus cannot quietly outrank a published one (CC10 [20]).
- Each knob is demonstrated changing routing independently, in the suite and
  live through `dist/` off a real `package.json`; none is theoretical.

## Data Model

Consumer config shape, exactly the conformance kit's `config.schema.json`
(RFC section 10.5, which wins over this doc's original `prefer: string[]`,
see known_issues): `{ prefer?: Record<string,string>, pin?:
Record<string,string>, disable?: string[], require?: Record<string,string>,
local?: Record<string,string> }`, read from the `comprehendo` key of the
consumer's own package.json. A read returns `{config, problems}`: a knob that
cannot be read is reported by name and dropped, never guessed, and never
thrown. `require` values are kept as written and checked against the trust
ladder `['community','endorsed','native']` at parse time (reported) and at
route time (refused).

## API/Interface

N/A as a consumer-facing primitive (no `primitives` entry): the entry
surface is the `comprehendo` key of the consuming project's own
package.json, not a function an agent calls. The seams it is read through:
`readConsumerConfigFile(path)` returns `{config, problems}`;
`createRouter(environment, config)` and `decideRoute(pkg, evidence, config,
corpus)` consume it per call; `discoverInstalledCorpora({root, buildIndex,
config})` reads `local` when it builds the environment.

## Business Rules

- All five knobs are consumer-side only; no provider mechanism can set or
  override them.
- `require` values map to the trust ladder: community, endorsed, native
  (Owner Endorsement [30], Wave 5).
- `local` corpora are private to the consuming project, never published
  to the public registry.

## Acceptance Criteria

- [x] Each of the five knobs demonstrably changes routing behavior in
      isolation: one describe per knob in `router-knobs.test.ts`, each
      asserting the pure decision AND the surface an agent calls
      (`comprehend`/`docs` answering differently with the knob than
      without). Verified to have teeth: ignoring `disable` turns 6 tests
      red, ignoring an unmet `require` 5, ignoring a mismatched `pin` 4,
      skipping the `local` mount 9, and ignoring `none` in `comprehend` 3.
- [x] `local` successfully mounts a private corpus for an internal package:
      `router-local-corpus.test.ts` writes a real corpus directory outside
      `node_modules` for a package that is not installed at all, and the
      router twins its errors and answers its docs. The same suite proves
      the private corpus joins the one index (an overlapping fingerprint
      comes back ambiguous, an identical one refuses to build).
- [x] A provider manifest cannot express any of these five knobs (CC8 [19]):
      structurally (the knob names and the provider-side field names are
      disjoint, both read from the kit schemas, never a copy), through the
      read (a provider manifest carrying all five projects to
      `{version, level}`), and at run time (the identical bytes in the
      provider's manifest change no route, while the consumer's own manifest
      changes five).

## Dependencies

- [22-router-precedence](22-router-precedence.md)

## Known Issues

Recorded in the frontmatter; every entry is a decision with its why, not a
loose end. The scope boundary worth reading first is `require`: the ladder is
real and wired, the trust DATA arrives with Owner Endorsement [30] in Wave 5.

## Fixed Issues

### Merge with 24-wrap-proxy regressed 22's `nativeEvidence` defect reporting (fixed 2026-08-22)

Not a defect in this build's own code; found while merging `feat/23-config
-loader` into `wave/comprehendo-wave-4`. This branch was cut from the wave
branch before 22's own review fix landed there (an unreadable-but-existing
target manifest must push an `EnvironmentDefect`, never silently return
`undefined`, see 22's Fixed Issues), so this build's edit to
`discoverInstalledCorpora`'s loop called `nativeEvidence(root, package)`
with two arguments, dropping the fix's third (`defects`).

- Fixed at the merge: the loop keeps 23's local-corpus mounting
  (`installed` and `mounted` both feeding one `loaded` list, same one
  -index property CC10 rests on) while restoring the three-argument call.
  No new test needed: 22's own regression test
  (`router-installed.test.ts`, "reports an unreadable target manifest as
  a defect") already covers this call site and passed once the argument
  was restored, confirming it would have caught the regression had the
  merge landed silently.
