---
id: 35-comprehendo-md-generator
title: COMPREHENDO.md Generator
type: COMPONENT
path: Distribution / COMPREHENDO.md Generator
source_files: [scripts/generate-comprehendo-md.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [13-docs-engine, 28-corpus-format]
tags: [comprehendo-md, generated-docs, drift-gate, file-browsing-discovery]
test_files: []
known_issues: []
---

# COMPREHENDO.md Generator

## What to Build

Generates `COMPREHENDO.md` at a package root from the packed corpus, and
fails CI when the file on disk is stale relative to the corpus it should
reflect (a drift gate, not a one-time generation script). This is the
file-browsing discovery channel: an agent that browses a repository
before running any code finds this file and learns the package speaks
Comprehendo. Must-not: `COMPREHENDO.md` is never hand-edited; any manual
edit is exactly the drift this gate exists to catch.

## Architecture

`scripts/generate-comprehendo-md.ts`. Reads the packed corpus (Corpus
Format [28]'s `pack()` output) and the Docs Engine [13] index/topic
structure to render the file. Runs as a CI gate: regenerate, diff against
the committed file, fail if they differ.

## Implementation Notes

- Principle 10 ("Generated, never hand-rotted") is the direct rationale:
  `COMPREHENDO.md`, translation tables, and corpora are all generated from
  tested truth with drift gates, specifically so hand-written docs never
  get a chance to rot behind a nicer interface.
- This generator's output is one of the four discovery channels named on
  Marker & Probe [11]'s doc: marker (runtime), manifest (static),
  `COMPREHENDO.md` (file-browsing), twin's own field (mid-failure). This
  component owns only the third.

## Data Model

`COMPREHENDO.md` content: package identity, the completeness contract
statement, the priming pointer, and a generated summary of the corpus's
topic index, sourced entirely from the packed corpus and Docs Engine [13]
metadata, no separately-authored prose.

## API/Interface

N/A directly; a build-time/CI generator, not called by agents.

## Business Rules

- `COMPREHENDO.md` content is fully derived from the packed corpus; no
  section is hand-authored independently of it.
- CI fails when the committed `COMPREHENDO.md` differs from a fresh
  regeneration.

## Acceptance Criteria

- [ ] `COMPREHENDO.md` regenerates byte-identically from an unchanged
      corpus.
- [ ] A corpus change that is not reflected in a regenerated
      `COMPREHENDO.md` fails CI as drift.
- [ ] The generated file correctly reflects the current topic index.

## Dependencies

- [13-docs-engine](13-docs-engine.md)
- [28-corpus-format](28-corpus-format.md)

## Known Issues

None recorded at plan time.
