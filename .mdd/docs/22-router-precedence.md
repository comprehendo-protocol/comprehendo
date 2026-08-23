---
id: 22-router-precedence
title: Router & Precedence
type: COMPONENT
path: Core / Router
source_files: [packages/core/src/router.ts, packages/core/src/router-precedence.ts, packages/core/src/router-discovery.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: [19-cc8-native-precedence, 21-fingerprint-index-matcher, 12-twin-builder]
tags: [sidecar, comprehend, precedence, fingerprint-match, no-cooperation-required]
test_files: [packages/core/test/router-decision.test.ts, packages/core/test/router-comprehend.test.ts, packages/core/test/router-docs.test.ts, packages/core/test/router-installed.test.ts]
known_issues:
  - "[resolved by 28-corpus-format] router-discovery.ts's on-disk shape was this adapter's provisional convention (three files), not a ruling. Corpus Format [28] (Wave 5) ruled the real one, comprehendo.corpus.json, corpus_packed: 1, and router-discovery.ts is migrated to read it: fingerprints/twins/docs all come out of the one artifact, version-gated, refusing an unknown corpus_packed by name rather than reading it lossily. Proven live: a real payload assembled with 28's own readPackedCorpus/serializeCorpus (the same functions Scoped Publisher [31] uses) is discovered with zero defects and routes correctly. See router-discovery.ts's own Fixed Issues on 28's doc, and 31's doc's known_issues, which measured this exact gap live before the fix landed."
  - "[deferred] The router is not re-exported from packages/core/src/index.ts: the barrel is outside this feature's source_files and sibling Wave-4 lanes build against the same package. The surface is imported from ./router.js (dist/router.js when built); wiring the barrel, and whether a module-level comprehend/docs singleton exists at all, is Wave 7 (Distribution)'s call, the same one core's package.json already defers."
  - "[resolved by 23-config-loader] Only the prefer knob was implemented here at build time. pin, disable, require and local now ship in Config Loader [23] (same wave), which widens RouterConfig to ConsumerConfig with no reshaping of this surface, exactly as anticipated."
  - "[gap] Core cannot import @comprehendo/registry-tools (the dependency direction is one-way and tsc rejects the cross-package path), so 21's matcher arrives as a structural port (CorpusMatcher) and the caller injects buildFingerprintIndex. Nothing in the shipped package wires a default matcher yet; that is Wave 7 (Distribution)'s assembly step. The suites load 21's real module at run time so no double is ever in the loop."
primitives:
  - name: "comprehend(raw)"
    kind: function
  - name: "docs(pkg, query)"
    kind: function
---

# Router & Precedence

## What to Build

The sidecar router: `comprehend(raw)` takes a caught error object or
stderr text, fingerprint-matches it against installed
`@comprehendo/<pkg>` corpora (with no cooperation from the target
package), and returns a twin or UNSTRUCTURED, side-effect free.
`docs(pkg, query)` answers from the sidecar corpus for an un-adopted
package. Precedence: native wins automatically when present, the
consumer `prefer` knob reverses it per package (CC8 [19]). Must-not: never
guess on an ambiguous match (CC10 [20]); never require the target package
to change anything to be routable.

## Architecture

Three files, split on the I/O boundary that "side-effect free" forces:
`router.ts` (the `comprehend`/`docs`/`decideFor` surface),
`router-precedence.ts` (the matcher port, what "installed" means as data,
and `decideRoute`, the precedence rule as one pure function), and
`router-discovery.ts` (the adapter that reads a real
`node_modules/@comprehendo` tree into that data). The first two import no
`node:` module at all, which is asserted by a source scan.

Consumes Fingerprint Index & Matcher [21]
for the match, Twin Builder [12] to construct the resulting twin, and
Marker & Probe [11] / Manifest Wiring [15] to detect whether a native
implementation is present for precedence. Consumed by Config Loader [23]
(the four other knobs modify this router's behavior) and Wrap Opt-In
Proxy [24] (an alternative entry into the same routing logic).

## Implementation Notes

- "No cooperation from the target package" is the whole point of the
  sidecar tier: the router works against a raw caught error with zero
  changes required in the un-adopted package.
- Precedence detection reads both the runtime marker (authoritative) and
  the static manifest (a hint); per the disagreement fixture (Conformance
  Fixtures [04]), the marker wins when they conflict.
- Installing a native implementation flips precedence automatically, with
  no router reconfiguration required, demonstrated live in the Wave 4
  demo-state. The mechanism that makes this true rather than lucky: the
  authoritative channel is the marker on the caught VALUE, read per call,
  for free, with no I/O. An installed native build starts throwing marked
  errors, and the next call sees it. The manifest half is picked up by the
  next discovery.
- What is installed arrives as DATA (`Environment`), so the routing half
  is pure and the filesystem half is one adapter. Config Loader [23] and
  Wrap Opt-In Proxy [24] both build on the data side, not the disk side.

## Data Model

Router decision: `{ package, source: 'native' | 'sidecar', reason }`,
computed per call from marker probe result, manifest, and the `prefer`
knob. Match result: twin (Shape Schemas [03]) or UNSTRUCTURED.

## API/Interface

- `comprehend(raw)`: error object or stderr text in; twin or UNSTRUCTURED
  out; side-effect free.
- `docs(pkg, query)`: sidecar docs lookup for an un-adopted package.

## Business Rules

- Native present, no override -> native handles the call.
- Native present, `prefer: sidecar` for that package -> sidecar handles
  the call.
- No native present -> sidecar handles the call unconditionally.
- Ambiguous fingerprint match -> UNSTRUCTURED with candidates named
  (CC10 [20]), never a guess.
- `comprehend(raw)` performs no I/O and has no observable side effects.

## Acceptance Criteria

- [x] `comprehend(raw)` on an uninstalled/un-adopted toy package
      fingerprints correctly to its `@comprehendo/<toy>` corpus. Proven
      against a real corpus package on disk, matched by Fingerprint Index
      & Matcher [21]'s real matcher (never a double), and live through
      the built `dist/` artifacts.
- [x] An unknown error returns UNSTRUCTURED, never a wrong match. An
      ambiguous match degrades the same way with both candidates named
      (CC10 [20]).
- [x] `docs('<toy>', query)` answers from the sidecar corpus, in the
      asker's vocabulary, through Docs Engine [13] unchanged.
- [x] Installing the native toy flips precedence automatically, verified
      live (no router reconfiguration step): the suite writes, imports
      and runs a real natively adopted package and hands the error it
      really throws to the SAME router instance, which answers native.
      Verified to have teeth: making native never win turned 15 tests
      red, and ignoring the native decision in `comprehend` turned 4 red.

## Dependencies

- [19-cc8-native-precedence](19-cc8-native-precedence.md)
- [21-fingerprint-index-matcher](21-fingerprint-index-matcher.md)
- [12-twin-builder](12-twin-builder.md)

## Known Issues

- [gap] The "imports no `node:` module at all" claim (Architecture,
  and both files' own docstrings) is true of `router.ts`'s and
  `router-precedence.ts`'s own literal imports, but not of their
  TRANSITIVE closure: `router-precedence.ts` -> `config.ts` and
  `router.ts` -> `docs.ts` both pull in `node:fs`/`node:path`. Found
  by review. Nothing calls a filesystem function at `comprehend()`
  -call time today (no I/O actually happens at runtime), but the
  module is not the bundler-safe, `node:`-free unit the claim
  asserts, and the guard test (`router-comprehend.test.ts`) only
  scans direct imports, unlike `marker-purity.test.ts`'s CC1 check on
  `marker.ts`, which correctly uses `transitiveImportClosure`. Fixing
  this needs either narrowing `router-precedence.ts`'s import of
  `config.ts` to a pure subset, or widening the test and correcting
  the claim; not done here since `config.ts` was under active
  concurrent development by 23-config-loader when this was found.

## Fixed Issues

### `nativeEvidence()` silently swallowed an unreadable target manifest (fixed 2026-08-22)

Found by review. A target `package.json` that EXISTS but cannot be
READ (a directory sitting where the file should be, a permissions
error) returned `undefined` with no diagnostic trail, inconsistent
with every other unreadable-artifact path in `router-discovery.ts`
(`loadCorpus`, `artifact`), which all push an `EnvironmentDefect`.

- Fixed by having `nativeEvidence()` push a defect naming the target
  on a read failure, same shape as every sibling function in the
  file. Mutation-verified: 1 new test, red without the fix.

### `router-discovery.ts` migrated to Corpus Format [28]'s authoritative artifact (fixed 2026-08-22)

This adapter's own on-disk convention was always documented as
provisional, deferred to Corpus Format [28] to rule on (Wave 5). Once
28 shipped and Scoped Publisher [31] became the first real producer of
the new format, the split was live and measured, not theoretical: 31's
own build installed its real assembled payload into a real consumer
tree and got `corpora found: 0`, `declares comprehendoCorpus but
carries none of the three corpus artifacts` (both 28's and 31's docs
recorded this).

- Fixed by migrating `router-discovery.ts` to the one artifact
  (`comprehendo.corpus.json`, `corpus_packed: 1`): `CORPUS_ARTIFACTS`
  (three filenames) replaced by `CORPUS_ARTIFACT` (one) and
  `CORPUS_PACKED_FORMAT`; `loadCorpusFrom` reads the one file once,
  version-gates it (refusing an unknown `corpus_packed` by name,
  never lossily, matching 28's own `readPackedCorpus` contract), and
  the fingerprints/twins/docs halves come out of the SAME parsed
  object. `registry-tools` still takes no runtime import from core,
  so the shape is read structurally (the same duplicate-plus-shape
  -check pattern `catalogIn`/`fingerprintsIn` already used), not
  through 28's real `readPackedCorpus`.
- All router test helpers (`sidecar.ts`'s `toyCorpusFiles`,
  `router-local-corpus.test.ts`'s `localCorpusFiles`) moved to build
  the new single-artifact format through 28's REAL
  `readPackedCorpus`/`serializeCorpus`, loaded the same
  cross-package-dynamic-import way 21's real matcher already was, so
  no fixture is typed to agree with the new reader under test.
- Mutation-verified: a new test (`router-installed.test.ts`, "refuses
  an unknown corpus_packed version by name, never reads it lossily")
  is red without the version gate. Verified live end to end through
  built `dist/` artifacts: a real payload assembled with 28's own
  `readPackedCorpus`/`serializeCorpus` (the exact functions 31 uses)
  is discovered with zero defects, and both `comprehend()` and
  `docs()` answer correctly from it.
- Full suite green throughout: core 540/540, registry-tools 242/242,
  spec 418/418 unaffected.

## Interface Overview

The router is what lets an agent get twins and docs for a package that
never adopted Comprehendo at all: install the sidecar corpus, and caught
errors from that package start resolving through the same two calls as a
native package would answer.

Both calls live on a router built from what is installed:
`createRouter(discoverInstalledCorpora({root, buildIndex}))` reads the
project's `node_modules` once, and the router it returns answers from
then on with no further I/O. The module-level `import { comprehend } from
'comprehendo'` form in the examples below is what Distribution (Wave 7)
assembles; today the two calls are reached through that router object,
and they take exactly the arguments shown.

| Name | What it does |
|---|---|
| `comprehend(raw)` | Matches a caught error or stderr text against an installed sidecar corpus and returns a twin or UNSTRUCTURED. |
| `docs(pkg, query)` | Answers a docs query for a specific un-adopted package from its sidecar corpus. |

### comprehend(raw)

Hand it whatever you caught, an error object or raw stderr text, and it
either comes back as a structured twin with a fix, or as an honest
UNSTRUCTURED if nothing cataloged matches. No setup required beyond
installing the sidecar corpus.

```js
import { comprehend } from 'comprehendo';
const result = comprehend(caughtError);
if (result.comprehendo) console.log(result.fixes[0].title);
```

### docs(pkg, query)

The sidecar equivalent of a native `docs()` call: name the package and ask
your question, get back one topic-sized answer from its installed
corpus.

| Parameter | Values | Description |
|---|---|---|
| `pkg` | package name string | Must have an installed `@comprehendo/<pkg>` corpus. |
| `query` | string | The question, in any supported vocabulary. |

```js
import { docs } from 'comprehendo';
const answer = docs('ffmpeg', 'how do I crop a video');
```
