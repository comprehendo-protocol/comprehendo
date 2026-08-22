---
id: 13-docs-engine
title: Docs Engine
type: COMPONENT
path: Core / Docs Engine
source_files: [packages/core/src/docs.ts, packages/core/src/docs-vocabulary.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [03-shape-schemas, 04-conformance-fixtures]
tags: [docs-engine, three-vocabulary, did-you-mean, undocumented, packed-corpus, miss-log]
test_files: [packages/core/test/docs.test.ts, packages/core/test/docs-miss-log.test.ts]
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

`packages/core/src/docs.ts` (plus `docs-vocabulary.ts`, the matcher,
extracted at the 300-line size gate). Consumes the packed-corpus artifact
(format defined by this feature, see Implementation Notes; produced in
this wave by Corpus Generator [17], which `depends_on` this feature) and
the topic/index shapes from Shape Schemas [03]. Used directly by SDK
Entry [14] and by Router & Precedence [22] for the sidecar
`docs(pkg, query)` path. Corpus Format [28] (Wave 5) is a later,
registry-scale formalization of the same artifact, gated behind the
`packed` version number; it is not this wave's producer.

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

### Packed-corpus artifact, format version 1

Defined by this feature, because this engine is the runtime that reads it.
Corpus Generator [17] must emit exactly this; Corpus Format [28] (Wave 5)
may later add an encoding behind the same `packed` version number, which
exists so a loader can refuse an artifact it cannot read.

One JSON file, loaded once, never a directory walk:

```json
{
  "comprehendo": "0.1",
  "packed": 1,
  "provider": "mongodb-operator",
  "index": ["aggregation stages", "$group", "..."],
  "topics": {
    "$group": {
      "topic": "$group",
      "summary": "the answer, written for an agent",
      "signatures": ["{ \"$group\": { \"_id\": <expression> } }"],
      "examples": [{ "title": "Count events per key", "code": "..." }],
      "see_also": ["aggregation stages", "$match"],
      "vocabularies_served": {
        "own_terms": ["$group", "group stage"],
        "translations": [{ "known_tool": "SQL", "terms": ["group by"] }],
        "task": ["count events per key"]
      }
    }
  }
}
```

Rules the loader enforces, each with a test:

- `packed` is required and must equal the format version this runtime
  reads. A missing or unknown version is refused, never guessed at.
- `comprehendo` and `provider` are required strings.
- `index` is the menu, in menu order, and is the ONLY thing `docs()`
  returns with no argument.
- `topics` has exactly one entry per `index` name, keyed by that name,
  and each entry's `topic` equals its key. An index name with no body,
  or a body the index never advertises, is refused.
- A topic body carries the `topic.schema.json` fields (`topic` and
  `summary` required, `signatures`/`examples`/`see_also` optional) plus
  `vocabularies_served`.
- `vocabularies_served` is the three matching tiers: `own_terms`
  (strings), `translations` (`{known_tool, terms[]}`), `task` (strings).
  A topic serving no vocabulary at all is refused, because nothing could
  ever reach it.
- `vocabularies_served` is authoring data and never appears in a
  response; keeping it out is part of how a topic answer stays inside
  its CC5 budget.

### Matching, did-you-mean, and the miss log

- Resolution is tier-blind on purpose: an exact normalized phrase match
  wins outright, otherwise an alias whose every token appears in the
  query scores by how many tokens it pinned down. One top scorer is the
  answer.
- A tie between two DIFFERENT topics is an ambiguity, and an ambiguity
  returns UNDOCUMENTED naming the tied topics in `nearest`. It never
  picks one.
- `nearest` is ranked across all three tiers at once by token similarity
  (shared prefix or edit distance, stopwords and short tokens excluded),
  floored so noise cannot qualify and capped at three. It is allowed to
  come back empty: padding it would be the confident wrong answer
  UNDOCUMENTED exists to avoid.
- The miss log is JSON Lines appended to a local relative path
  (`.comprehendo/docs-usage.log` by default). A log that cannot be
  written never breaks `docs()`, and the failure is counted rather than
  swallowed (`logStats()`).

## Data Model

Corrected to match `packages/spec/kit/shapes/*.schema.json` (the RFC wins
over an earlier draft of this section, per CLAUDE.md's own tiebreak; see
Fixed Issues).

- **Index response**: topic names only, no bodies.
- **Topic response** (`topic.schema.json`): `{topic, summary,
  signatures?, examples?, see_also?}`. `vocabularies_served` is
  corpus-side authoring/matching data (see the packed-corpus format
  below), never echoed in this response, which is part of how a topic
  answer stays inside its CC5 budget.
- **UNDOCUMENTED** (`undocumented.schema.json`): `{comprehendo, code:
  "UNDOCUMENTED", query, nearest: string[], source_permitted: true}`.
  `nearest` is required and MAY be empty.
- **Miss-log entry**: `{query, timestamp, result: 'index' | 'hit' | 'miss',
  topic?}`, local file only. `index` records a no-argument browse, which is
  a lookup with no query and no topic; forcing it into `hit` or `miss`
  would make the log lie.

## API/Interface

- `docs(query?)`: no arg returns the index; a query string returns a topic,
  did-you-mean, or UNDOCUMENTED.

Supporting exports, so SDK Entry [14] can wire a provider without
re-implementing any of this:

- `loadPackedCorpus(path)`: reads and validates the one packed artifact.
- `parsePackedCorpus(raw)`: the same validation over an in-memory object.
- `createDocs(corpus, options?)`: returns the `docs(query?)` surface bound
  to that corpus. `options` is `{logPath?, sink?, now?}`; the returned
  surface also carries `logStats()` -> `{written, failed}`.

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

- [x] `docs()` with no argument returns names-only index content.
- [x] `docs(query)` resolves correctly across all three vocabulary tiers
      in the kit's fixtures.
- [x] An unmatched query returns UNDOCUMENTED with did-you-mean, never an
      empty result.
- [x] The local miss log records every lookup and is never written to
      anywhere network-reachable (CC6 [27] scan passes).
- [x] Topic and index responses measure under their CC5 [02] budgets.

## Dependencies

- [03-shape-schemas](03-shape-schemas.md)
- [04-conformance-fixtures](04-conformance-fixtures.md)

## Known Issues

None open.

## Fixed Issues

### Data Model section did not match the shipped shapes (fixed 2026-08-22)

Was: this section spelled UNDOCUMENTED as `{query, did_you_mean,
source_pass_permitted}` and the topic response as `{topic,
vocabularies_served, see_also, body}`, neither matching
`kit/shapes/{undocumented,topic}.schema.json` or any 04 kit fixture.

- Fixed by correcting this section to the real, shipped shapes (see Data
  Model above), which is what `docs.ts` actually implements and what the
  test suite validates against the kit's schemas directly.

### Doc named the wrong wave-2 packed-corpus producer (fixed 2026-08-22)

Was: Architecture named Corpus Format [28] (Wave 5, unbuilt) as this
engine's artifact producer. The real Wave-2 relationship is the reverse:
[17-corpus-generator](17-corpus-generator.md) `depends_on` THIS feature,
so this component owns the runtime contract 17 must emit.

- Fixed by defining a versioned packed-corpus format here (`packed: 1`,
  see Implementation Notes) and correcting Architecture to name 17 as
  the wave-2 producer, with [28] noted as a later, registry-scale
  formalization of the same artifact, gated by the version field.

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
