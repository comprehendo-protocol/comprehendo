---
id: 28-corpus-format
title: Corpus Format
type: COMPONENT
path: Registry / Corpus Format
source_files: [packages/registry-tools/src/corpus-format.ts, packages/registry-tools/src/corpus-source.ts, packages/registry-tools/src/corpus-validate.ts, packages/registry-tools/src/corpus-apply.ts, packages/registry-tools/src/corpus-violation.ts, packages/registry-tools/src/corpus-front-matter.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: [03-shape-schemas]
tags: [corpus-format, packed-artifact, one-topic-per-file, yaml-header, parse-validate-pack]
test_files: [packages/registry-tools/test/corpus-parse.test.ts, packages/registry-tools/test/corpus-validate.test.ts, packages/registry-tools/test/corpus-pack.test.ts, packages/registry-tools/test/corpus-format-drift.test.ts]
known_issues:
  - "[gap] packages/core/src/router-discovery.ts still reads Router & Precedence [22]'s three PROVISIONAL artifact names and does not know comprehendo.corpus.json, so a corpus published in the format ruled here is readable by this component's own loader and not yet by 22's discovery adapter. That file is outside this feature's source_files. The migration is small and named: CORPUS_ARTIFACTS becomes the one artifact, loadCorpusFrom reads it once, and the fingerprints/twins/docs halves come out of it. Nothing regresses today: 22's suites build their own corpora and Scoped Publisher [31] is the first real producer."
  - "[gap] Corpus Generator [17]'s writeCorpus rewrites manifest.json wholesale from {header, target, manifest_hint}, so a hand-added declared_schema is silently DROPPED by the next comprehendo scan. That contradicts 17's own rule that a re-scan never touches a human-owned field, and no placement in the authoring format avoids it because all five files are fully rewritten. Fix is one field carried through 17's readCorpus/writeCorpus; both outside this feature's source_files."
  - "[deferred] The CC7 [09] apply grammar is implemented twice, here and in core's validateCatalog, because registry-tools takes no runtime import from core (packages install independently; a ../../core/src import from src/ breaks rootDir). Held by an agreement test that runs core's REAL gate over the same corpus rather than by shared code. Same call 21 made for the UNSTRUCTURED literals; a real shared-constants package, if one is ever wanted, is a later decision."
  - "[deferred] pack emits JSON, not a binary encoding. Zero runtime dependencies means any binary format is hand-rolled twice (TypeScript and Python, identical conformance kit), and a published artifact a PR reviewer cannot read costs Submission Gate [29] its review property. corpus_packed is the answer to the open question: a binary encoding arrives as version 2 and readPackedCorpus already refuses an unknown version by name."
  - "[deferred] registry-tools has no src/index.ts barrel, so Submission Gate [29] and Scoped Publisher [31] import ./corpus-format.js directly. Creating one is outside this feature's source_files and is the same Wave 7 (Distribution) packaging decision core's package.json already defers."
  - "[gap] validate reports a stub-bearing corpus as stub-field violations and pack refuses one, but whether a PR carrying stubs may be SUBMITTED at all is Submission Gate [29]'s policy, not settled here."
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

Six files in `packages/registry-tools/src/`, split at the size gate the
same way `twin.ts`/`twin-validate.ts` and
`fingerprint.ts`/`fingerprint-facets.ts` split before them:

| Module | Job |
|---|---|
| `corpus-format.ts` | the surface: the packed artifact, `pack`, `readPackedCorpus`, `catalogOf`, and the re-exports so a consumer imports one module |
| `corpus-source.ts` | `parse`, and the ONLY filesystem walk in the component |
| `corpus-validate.ts` | `validate`, the whole gate, pure |
| `corpus-apply.ts` | the CC7 [09] apply grammar, the security fence |
| `corpus-violation.ts` | what a refusal is, and the reason vocabulary |
| `corpus-front-matter.ts` | the YAML header dialect, reader only |

Consumed by Corpus Generator [17] (writes files in this format),
Submission Gate [29] (parses and validates a PR's corpus directory), and
Scoped Publisher [31] (packs the validated corpus for publish).

Nothing here imports `packages/core`: the dependency direction is one-way
and the packages install independently, so the shapes this component
shares with core are duplicated and held by drift and agreement tests
(see Known Issues).

## Implementation Notes

### The packed-format ruling (Wave-1 open question, closed here)

The packed-corpus format was an open design question, and Router &
Precedence [22] shipped a PROVISIONAL convention against it (three files:
`comprehendo.fingerprints.json`, `comprehendo.twins.json`,
`comprehendo.packed.json`, plus an optional `comprehendoCorpus.target`
key). This component owns the answer, and the answer is:

1. **One artifact**, `comprehendo.corpus.json`, `corpus_packed: 1`,
   carrying every half. Three files is three chances for a corpus package
   to ship half-updated, and the failure mode is silent: a fingerprint
   naming a twin code the catalog no longer carries MATCHES and then
   answers UNSTRUCTURED. An atomic artifact makes that unrepresentable.
2. **`comprehendoCorpus` keeps 22's spelling**, and `target` keeps its
   meaning, so a corpus package still declares what it is a corpus FOR in
   the one place 22 already looks. `format` and `artifact` join it, so a
   reader knows the format version BEFORE opening the file.
3. **The docs half is verbatim Docs Engine [13]'s `packed: 1`**, not a
   re-encoding, so 13's own `parsePackedCorpus` is the acceptance test for
   it and 13 needs no migration at all. Same for the twins half, which is
   verbatim Twin Builder [12]'s `ProviderCatalog`, and the fingerprints,
   which are verbatim Fingerprint Index & Matcher [21]'s entries.

JSON rather than a binary encoding, deliberately; see Known Issues.

### Fingerprint binding: `corpusEntryId` is the published CODE

`router.ts` resolves a match with
`builder.twinFor(match.entry.corpusEntryId, raw)`, so a packed
fingerprint's `corpusEntryId` is the twin's published `code`, never 17's
authoring twin `id`. Binding the id instead does not throw and does not
fail a type: the fingerprint matches, the catalog lookup misses, and the
router hands back UNSTRUCTURED for a failure the corpus fully documents.
The binding has its own test.

### `declared_schema`, the slot CC7 [09] needs

The five-file authoring format had no slot for the provider's declared
call schema anywhere, so every `apply` in every corpus was uncheckable and
CC7 was unenforceable at the registry tier. This format adds
`declared_schema: {surface, operations[], nested_pipeline_operations?}` to
`manifest.json`. It is optional (a corpus with no `apply` needs none) and
a corpus carrying an `apply` with no schema is refused
(`undeclared-call-schema`) rather than waved through: an apply nobody can
check is not an apply that is safe.

### Two formats, still on purpose

The AUTHORING format (`corpus_authoring: 1`, Corpus Generator [17]) is
five human-edited files carrying stubs, field ownership, and one topic per
file. The PUBLISHED format (`corpus_packed: 1`, defined here) is one file
carrying none of those. `pack` is the compile step, which is what lets
authoring ergonomics and runtime cost be optimized separately instead of
traded off against each other.

## Data Model

### Source tree (`corpus_authoring: 1`, read by `parse`)

```
comprehendo/
  manifest.json     provider, target, manifest hint, declared_schema?
  index.json        the topic menu, in menu order
  topics/<slug>.md  one topic per file: YAML header plus summary prose
  twins.json        one record per cataloged failure, with its fingerprint
  fixes.json        fixes, keyed by twin id
```

A twin's `fingerprint` is read as `{exception -> errorClass,
message_pattern -> messagePattern, stack_shape? -> stackShape, kind?}`:
17 spells a throw site the way a scanner sees it, 21 spells the same
facets the way a matcher checks them, and translating between them is
this format's job rather than the runtime's.

### Packed artifact (`corpus_packed: 1`, produced by `pack`)

One file, `comprehendo.corpus.json`:

```json
{
  "comprehendo": "0.1",
  "corpus_packed": 1,
  "package": "toy-encoder",
  "provider": "toy-encoder",
  "version": "2.1.0",
  "docs": { "packed": 1, "index": ["encode"], "topics": { "encode": {} } },
  "twins": { "declaredSchema": {}, "topics": ["encode"], "entries": [] },
  "fingerprints": [
    { "package": "toy-encoder", "errorClass": "RangeError",
      "messagePattern": "input must not be empty",
      "corpusEntryId": "TOY_EMPTY_INPUT" }
  ]
}
```

The package.json descriptor beside it:
`"comprehendoCorpus": {"target": "toy-encoder", "format": 1, "artifact": "comprehendo.corpus.json"}`.

## API/Interface

- `parse(corpusDir)`: reads a corpus source tree into a `CorpusSource`.
  Refuses, naming the file, anything that stops it reading at all (a
  missing or unparseable file, an authoring version it does not
  understand, a topic file the index advertises and the disk lacks).
- `validate(corpus)`: every violation as data, in one pass, never
  throwing. Rules `CC3`, `CC7`, `CATALOG` and `FORMAT`; the reason
  vocabulary is core's, so the agreement test can hold the two tiers
  together.
- `pack(corpus)`: runs `validate` itself and throws `CorpusFormatError`
  (carrying the violations) if it reports anything, otherwise compiles the
  single runtime artifact.
- `readPackedCorpus(raw)`: the runtime-side loader. Refuses an unknown
  `corpus_packed` version naming both versions, rather than reading the
  fields it recognises and dropping the rest.
- `serializeCorpus(packed)` / `corpusDescriptor(packed)`: the artifact as
  deterministic bytes, and the package.json block beside it.
- `catalogOf(corpus)`: the `ProviderCatalog` a validated corpus describes,
  the seam the registry and native tiers meet at.
- Constants: `CORPUS_ARTIFACT`, `CORPUS_PACKED_FORMAT`,
  `CORPUS_DESCRIPTOR_KEY`, `AUTHORING_FORMAT`, `AUTHORING_FILES`, `STUB`,
  `PACKED_DOCS_FORMAT`, `COMPREHENDO_VERSION`.

## Business Rules

- One topic per file; a file covering more than one topic is a format
  violation (`one-topic-per-file`), and so are two index entries sharing
  one file, and a topic file no index entry advertises.
- The packed artifact is versioned; a runtime loader that does not
  understand a packed artifact's version fails clearly rather than
  attempting a lossy read. Both versions the artifact carries
  (`corpus_packed` and the docs half's `packed`) gate.
- `validate` runs before `pack`; a corpus that fails validation is never
  packed. Structural, not a calling convention: `pack` runs it itself.
- A fix's `apply` stays inside the provider's declared call schema, and a
  fix's or twin's `docs` pointer resolves to a topic the index carries
  (CC7 [09]).
- A twin never claims the reserved `UNSTRUCTURED` code, never publishes a
  code twice, never carries an empty reason, and never pastes its own
  throw-site text into `reason` (CC3 [08]).
- A field still carrying `status: stub` is reported, and a stub-bearing
  corpus is never packed: the packed format has no representation for a
  field nobody wrote.
- A twin declaring no matchable fingerprint facet is refused, because it
  would match every error or none.

## Acceptance Criteria

- [x] `parse` correctly reads the five-file corpus shape produced by
      Corpus Generator [17]. Proven against a tree 17's OWN `runInit`,
      `runScan` and `writeCorpus` wrote to a real disk, loaded at run time
      by the same cross-package dynamic import core's suites already use
      for this package's matcher. No fixture is typed to agree with the
      parser under test.
- [x] `validate` rejects a corpus violating Shape Schemas [03] or the
      CC7 [09] schema-bound-fix rule, naming the violation. Verified to
      have teeth: disabling the apply check turns 4 tests red, and the
      agreement test runs core's REAL `validateCatalog` over the same
      corpus and asserts this gate reports every reason it does.
- [x] `pack` produces a single runtime artifact that Docs Engine [13]
      loads without directory access. Proven live through the built
      `dist/` artifacts: one file on disk, read once, handed to 13's own
      `createDocs`, which answers `docs()` and `docs('encode')`; the same
      file's fingerprints matched a real thrown `RangeError` through 21's
      real matcher and 12's real builder returned the cataloged twin.

## Dependencies

- [03-shape-schemas](03-shape-schemas.md)

## Known Issues

- [gap] `packages/core/src/router-discovery.ts` still reads 22's three
  provisional artifact names and does not know
  `comprehendo.corpus.json`. Outside this feature's `source_files`; the
  migration is named in the frontmatter entry.
- [gap] 17's `writeCorpus` silently drops a hand-added `declared_schema`
  on the next `scan`, contradicting 17's own human-owned-field rule.
  Outside this feature's `source_files`.
- [deferred] The CC7 apply grammar is implemented twice (here and in
  core), held by an agreement test rather than shared code, because
  registry-tools takes no runtime import from core.
- [deferred] `pack` emits JSON, not a binary encoding; `corpus_packed` is
  the version number a binary encoding would arrive under.
- [deferred] registry-tools has no `src/index.ts` barrel, so 29 and 31
  import `./corpus-format.js` directly.
- [gap] Whether a PR carrying stubs may be SUBMITTED at all is Submission
  Gate [29]'s policy; this component only detects them and refuses to
  pack one.
