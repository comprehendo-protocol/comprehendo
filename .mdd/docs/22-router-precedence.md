---
id: 22-router-precedence
title: Router & Precedence
type: COMPONENT
path: Core / Router
source_files: [packages/core/src/router.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: [19-cc8-native-precedence, 21-fingerprint-index-matcher, 12-twin-builder]
tags: [sidecar, comprehend, precedence, fingerprint-match, no-cooperation-required]
test_files: []
known_issues: []
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

`packages/core/src/router.ts`. Consumes Fingerprint Index & Matcher [21]
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
  demo-state.

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

- [ ] `comprehend(raw)` on an uninstalled/un-adopted toy package
      fingerprints correctly to its `@comprehendo/<toy>` corpus.
- [ ] An unknown error returns UNSTRUCTURED, never a wrong match.
- [ ] `docs('<toy>', query)` answers from the sidecar corpus.
- [ ] Installing the native toy flips precedence automatically, verified
      live (no router reconfiguration step).

## Dependencies

- [19-cc8-native-precedence](19-cc8-native-precedence.md)
- [21-fingerprint-index-matcher](21-fingerprint-index-matcher.md)
- [12-twin-builder](12-twin-builder.md)

## Known Issues

None recorded at plan time.

## Interface Overview

The router is what lets an agent get twins and docs for a package that
never adopted Comprehendo at all: install the sidecar corpus, and caught
errors from that package start resolving through the same two calls as a
native package would answer.

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
