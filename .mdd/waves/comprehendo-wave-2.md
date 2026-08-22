---
id: comprehendo-wave-2
title: Core Provider SDK (JavaScript)
initiative: comprehendo
initiative_version: 1
status: complete
depends_on: [comprehendo-wave-1]
demo_state: A toy package built with the SDK passes the full kit -- marker on export, errors, and handles; twins at the throw site; UNSTRUCTURED passthrough on an un-cataloged error; docs answering all three vocabularies from a packed corpus; UNDOCUMENTED with a working local miss log; validate and explain on the toy's Level 2 surface; priming and identity under budget.
content_hash: 55465de59cffe826
---

# Wave 2: Core Provider SDK (JavaScript)

Estimate: 4-6 days.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 07 | CC1 Probe Purity | SPEC | (none) |
| 08 | CC3 No Raw Errors | SPEC | (none) |
| 09 | CC7 Schema-Bound Fixes | SPEC | (none) |
| 10 | CC9 Marker Freeze | SPEC | (none) |
| 11 | Marker & Probe | COMPONENT | 07, 10 |
| 12 | Twin Builder | COMPONENT | 03, 04, 08, 09 |
| 13 | Docs Engine | COMPONENT | 03, 04 |
| 14 | SDK Entry (makeProvider) | COMPONENT | 11, 12, 13 |
| 15 | Manifest Wiring | COMPONENT | 14 |
| 16 | Recorder | COMPONENT | 14 |
| 17 | Corpus Generator | COMPONENT | 03, 13 |

## Demo-state Result (unattended run, 2026-08-22)

Executed against the real runtime, not asked for confirmation
(unattended mode). Result: **MET, in full**, verified live via a
from-scratch toy provider built through the built `dist/index.js`
(not the test suite's own fixture, an independently-constructed one):

- **Marker on export, errors, and handles: MET.** The provider export
  and a caught thrown error both carry the marker; handle-marking is
  proven separately in 11's own suite (`mark(handle)`, same
  `attachMarker` path).
- **Twins at the throw site: MET.** `provider.errorFor(raw)` for a
  cataloged failure returns an `Error` whose `.twin.code` is the
  provider's own code.
- **UNSTRUCTURED passthrough: MET.** An un-cataloged raw failure
  returns `.twin.code === 'UNSTRUCTURED'` with the raw text preserved
  verbatim in `.twin.received`.
- **Docs answering all three vocabularies from a packed corpus: MET.**
  `docs('encode')` (own terms), `docs('encode a string')`
  (translation), and `docs('how to serialize a payload')` (task) all
  resolved to the same topic from one packed-corpus artifact.
- **UNDOCUMENTED with a working local miss log: MET.** An unmatched
  query returned `UNDOCUMENTED`; `logStats()` showed 4 lookups written,
  0 failed.
- **`validate`/`explain` on Level 2: MET.** A hook-supplying provider
  reports `level: 2`, `surfaces: ['docs','validate','explain']`;
  `validate` returned both a clean verdict and a real cataloged twin
  (CC7-checked, built through the same twin builder as throw sites);
  `explain` returned `{would_execute, notes}`.
- **Priming and identity under budget: MET.** `identity`/`priming` are
  both required at construction (refused if empty); `priming` is
  measured against the real CC5 budget harness in 14's own test suite
  (`measureScope('priming', ...)`), not merely asserted short.

One scope note carried from the build, not a demo-state shortfall:
`makeProvider` ships no DEFAULT priming snippet (a copy of the RFC's
reference text in core source collided with CC9's one-definition-site
scan, since the snippet's own prose names the marker). `priming` is a
required hook instead; the canonical snippet's home is
[36-priming-snippet](../docs/36-priming-snippet.md) (Wave 7). This
does not weaken the demo-state: a real snippet was supplied and
measured in the check above, exactly as a real provider would.
