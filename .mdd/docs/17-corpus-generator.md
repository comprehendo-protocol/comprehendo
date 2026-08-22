---
id: 17-corpus-generator
title: Corpus Generator
type: COMPONENT
path: Core / Corpus Generator
source_files: [packages/core/src/cli/]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [03-shape-schemas, 13-docs-engine]
tags: [cli, scaffolding, corpus-authoring, drift-detection, stub-field, upstream-watch]
test_files: []
known_issues: []
primitives:
  - name: "comprehendo init"
    kind: cli-verb
  - name: "comprehendo scan"
    kind: cli-verb
  - name: "comprehendo diff"
    kind: cli-verb
---

# Corpus Generator

## What to Build

Three CLI verbs that make corpus authoring start from a machine-filled
skeleton instead of a blank directory (the dts-gen precedent: a blank
directory is where contributions die). `comprehendo init` scaffolds the
five-file corpus shape. `comprehendo scan` walks the target code and
pre-fills everything a machine can know: exports and signatures from
types, docstrings as DRAFT summaries, throw/raise sites as twin skeletons
with exception types pre-filled in fingerprints, and the topic index.
`comprehendo diff` re-scans against a new version and reports drift, which
IS the upstream-watch input. Also serves `local` corpora for internal
packages. Must-not: a re-scan never touches human-owned fields.

## Architecture

`packages/core/src/cli/`. Reads target-package types/docstrings/throw
sites, writes corpus files in the Corpus Format [28] shape (Wave 5), and
validates the topic index and shapes against Shape Schemas [03] and Docs
Engine [13]'s expectations.

## Implementation Notes

- Field ownership is the core constraint: machine-owned fields
  (signatures, inventories) regenerate freely on every `scan`; human
  -owned fields (reason, fixes, summaries, aliases) are never touched by a
  re-scan, even when the underlying code changed.
- Every field a scan cannot fill is marked `status: stub`. The
  Submission Gate [29] rejects corpora containing stubs; the folklore
  rule (CC4 [26]) is the backstop even if a stub slips through, because a
  knowledge-free twin has no inducing test.
- `comprehendo diff` is the mechanism `upstream-watch` (Upstream Watch
  [34], Wave 6) builds on: re-scanning against a new upstream version and
  reporting what drifted is the same operation whether the corpus author
  runs it manually or a lock file runs it in CI.

## Data Model

Generated corpus file, per the five-file shape (Corpus Format [28]):
topic markdown with YAML header (`topic, vocabularies_served, see_also,
status`), twins JSON, fixes JSON. `status: stub` marks any field a scan
could not fill.

## API/Interface

- `comprehendo init`: scaffolds the five-file corpus shape for a target
  package.
- `comprehendo scan`: walks the target code, pre-fills machine-derivable
  fields, marks the rest `status: stub`.
- `comprehendo diff`: re-scans against a new version, reports drift
  against the existing corpus.

## Business Rules

- `scan` never overwrites a human-owned field (reason, fixes, summaries,
  aliases), regardless of what changed in the target code.
- Every field `scan` cannot fill is marked `status: stub`, never left
  silently blank or guessed.
- A corpus containing any `status: stub` field is rejected by the
  Submission Gate [29].
- The same tool serves `local` corpora for internal packages, no
  separate code path.

## Acceptance Criteria

- [ ] `comprehendo init` produces the five-file corpus shape for a target
      package.
- [ ] `comprehendo scan` pre-fills exports/signatures/docstrings/throw
      -site skeletons and marks unfillable fields `status: stub`.
- [ ] A second `scan` on unchanged human-owned fields leaves them
      byte-identical.
- [ ] `comprehendo diff` reports drift against a new target-package
      version.

## Dependencies

- [03-shape-schemas](03-shape-schemas.md)
- [13-docs-engine](13-docs-engine.md)

## Known Issues

None recorded at plan time.

## Interface Overview

The corpus generator is the on-ramp for anyone writing a Comprehendo
corpus, native or `local`: instead of starting from an empty directory,
you get a skeleton that already knows your package's exports, signatures,
and throw sites, so writing a corpus is filling in the parts only a human
can know (why a failure happens, what fixes it), not typing out structure.

| Name | What it does |
|---|---|
| `comprehendo init` | Scaffolds a new five-file corpus for a target package. |
| `comprehendo scan` | Pre-fills machine-derivable fields from the target code; marks the rest `status: stub`. |
| `comprehendo diff` | Re-scans against a new version and reports what drifted. |

### comprehendo init

Run this once, pointed at the package you're writing a corpus for. It
creates the five-file shape (topics, twins, fixes, index, manifest hint)
ready for `scan` to fill in.

```sh
comprehendo init ./my-package
```

### comprehendo scan

Walks the target package's exports, types, docstrings, and throw/raise
sites, and fills in every field a machine can determine. Fields it cannot
determine are marked `status: stub`. Safe to re-run: it never touches
fields a human has already written (reason, fixes, summaries, aliases).

```sh
comprehendo scan ./my-package
```

### comprehendo diff

Re-scans the target package at its current version and reports drift
against the existing corpus, field by field. This is the upstream-watch
input: run it after a dependency bump to see what the corpus needs
updating.

```sh
comprehendo diff ./my-package
```
