---
id: 28-corpus-format
title: Corpus Format
type: COMPONENT
path: Registry / Corpus Format
source_files: [packages/registry-tools/src/corpus-format.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: [03-shape-schemas]
tags: [corpus-format, packed-artifact, one-topic-per-file, yaml-header, parse-validate-pack]
test_files: []
known_issues: []
---

# Corpus Format

## What to Build

The corpus file format itself: one topic per markdown file with a small
YAML header (`topic`, `vocabularies_served`, `see_also`), twins and fixes
as JSON beside the topic files, and the whole corpus compiled to a single
packed artifact at publish time so runtime never walks directories. Three
operations: `parse` (file tree in, structured corpus out), `validate`
(structured corpus against Shape Schemas [03] and CC7 [09]'s schema-bound
check), `pack` (structured corpus in, single runtime artifact out).
Must-not: runtime code (Docs Engine [13], Router & Precedence [22]) never
walks a corpus directory; it only ever loads a packed artifact.

## Architecture

`packages/registry-tools/src/corpus-format.ts`. Consumed by Corpus
Generator [17] (writes files in this format), Submission Gate [29]
(parses and validates a PR's corpus directory), and Scoped Publisher
[31] (packs the validated corpus for publish).

## Implementation Notes

- The packed-corpus binary format and its versioning is an explicit
  Wave-1 open design question in the source spec; this component's
  `pack()` output format is the concrete answer once that is ruled on.
- One topic per file keeps authoring and review tractable; the pack step
  is what collapses that back to one runtime-efficient artifact, so
  authoring ergonomics and runtime cost are optimized separately, not
  traded off against each other.

## Data Model

- **Source tree**: `topics/<name>.md` (YAML header + markdown body),
  `twins.json`, `fixes.json`, per corpus directory.
- **Packed artifact**: a single versioned binary/JSON artifact containing
  the compiled topic index, all topic bodies, twins, and fixes, loaded
  once at runtime.

## API/Interface

- `parse(corpusDir)`: reads a corpus source tree into a structured
  in-memory corpus.
- `validate(corpus)`: checks the structured corpus against Shape Schemas
  [03] and the CC7 [09] schema-bound-fix rule.
- `pack(corpus)`: compiles a validated structured corpus into the single
  runtime artifact.

## Business Rules

- One topic per file; a file covering more than one topic is a format
  violation.
- The packed artifact is versioned; a runtime loader that does not
  understand a packed artifact's version fails clearly rather than
  attempting a lossy read.
- `validate` runs before `pack`; a corpus that fails validation is never
  packed.

## Acceptance Criteria

- [ ] `parse` correctly reads the five-file corpus shape produced by
      Corpus Generator [17].
- [ ] `validate` rejects a corpus violating Shape Schemas [03] or the
      CC7 [09] schema-bound-fix rule, naming the violation.
- [ ] `pack` produces a single runtime artifact that Docs Engine [13]
      loads without directory access.

## Dependencies

- [03-shape-schemas](03-shape-schemas.md)

## Known Issues

- [gap] The packed-corpus binary format and its versioning scheme is an
  open Wave-1 design question, not yet ruled on.
