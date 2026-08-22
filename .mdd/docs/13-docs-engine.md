---
id: 13-docs-engine
title: Docs Engine
type: COMPONENT
path: Core / Docs Engine
source_files: [packages/core/src/docs.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [03-shape-schemas, 04-conformance-fixtures]
tags: [docs-engine, three-vocabulary, did-you-mean, undocumented, packed-corpus, miss-log]
test_files: []
known_issues: []
primitives:
  - name: "docs(query?)"
    kind: function
---

# Docs Engine

## What to Build

The docs surface: no argument returns an index (names only); a query
returns one topic-sized answer, matched across three vocabularies (the
tool's own terms, the terms of tools the model already knows, and task
language), with did-you-mean across all three tiers when a query does not
match, and UNDOCUMENTED (never a bare miss, never an empty result, never a
wrong topic) when nothing answers. Loads from a single packed-corpus
artifact at runtime, never walks directories. Logs every lookup, hit or
miss, to a local file: hits show which topics earn their keep, misses are
the next release's raw material, and nothing is ever transmitted.
Must-not: never dump the whole corpus for an unqualified query; never
guess a topic when the match is ambiguous.

## Architecture

`packages/core/src/docs.ts`. Consumes the packed-corpus artifact produced
by Corpus Format [28] and the topic/index shapes from Shape Schemas [03].
Used directly by SDK Entry [14] and by Router & Precedence [22] for the
sidecar `docs(pkg, query)` path.

## Implementation Notes

- Three vocabularies is the on-ramp: a model's first instinct is its
  trained vocabulary, so a query in the tool's own terms, in a known
  -tool's equivalent terms, or in plain task language should all resolve
  to the same topic when one exists.
- The local usage log is not telemetry (CC6 [27]): it is a file on the
  maintainer's own machine, never transmitted, and it is how a maintainer
  learns which topics justify themselves and which queries keep missing.
- Topic and index responses are measured against CC5 [02]'s budgets by
  the Budget Harness [06]; this engine must not exceed them.

## Data Model

- **Index response**: topic names only, no bodies.
- **Topic response**: one topic-sized answer, `{topic, vocabularies_served, see_also, body}`.
- **UNDOCUMENTED**: `{query, did_you_mean: string[], source_pass_permitted: true}`.
- **Miss-log entry**: `{query, timestamp, result: 'hit' | 'miss', topic?}`,
  local file only.

## API/Interface

- `docs(query?)`: no arg returns the index; a query string returns a topic,
  did-you-mean, or UNDOCUMENTED.

## Business Rules

- No query -> index, names only, never bodies.
- A query that matches -> exactly one topic-sized answer.
- A query that does not match -> UNDOCUMENTED with did-you-mean across all
  three vocabulary tiers, never an empty result, never a best-guess topic.
- UNDOCUMENTED explicitly permits one source-consultation pass for that
  question, the completeness contract's own escape hatch.
- Every lookup, hit or miss, is appended to the local miss log; nothing is
  ever transmitted off the machine.

## Acceptance Criteria

- [ ] `docs()` with no argument returns names-only index content.
- [ ] `docs(query)` resolves correctly across all three vocabulary tiers
      in the kit's fixtures.
- [ ] An unmatched query returns UNDOCUMENTED with did-you-mean, never an
      empty result.
- [ ] The local miss log records every lookup and is never written to
      anywhere network-reachable (CC6 [27] scan passes).
- [ ] Topic and index responses measure under their CC5 [02] budgets.

## Dependencies

- [03-shape-schemas](03-shape-schemas.md)
- [04-conformance-fixtures](04-conformance-fixtures.md)

## Known Issues

None recorded at plan time.

## Interface Overview

`docs` is the in-process reference for a Comprehendo-speaking package: no
website, no search index, just a function call that answers in exactly the
vocabulary you asked in. Call it with nothing to see what topics exist;
call it with a question to get one topic-sized answer back.

| Name | What it does |
|---|---|
| `docs(query?)` | Returns the topic index (no arg) or one matched topic, did-you-mean, or UNDOCUMENTED (with a query). |

### docs(query?)

The single entry point for asking a provider anything about itself. Omit
the argument to browse what exists; pass a question in whatever
vocabulary you already know (the tool's own terms, an equivalent tool's
terms, or plain task language) and get back one focused answer.

| Parameter | Values | Description |
|---|---|---|
| `query` | string, optional | The question, in any of the three supported vocabularies. |

```js
const index = docs();
const answer = docs('how do I crop a video');
```
