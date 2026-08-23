---
id: 17-corpus-generator
title: Corpus Generator
type: COMPONENT
path: Core / Corpus Generator
source_files: [packages/core/src/cli/]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [03-shape-schemas, 13-docs-engine]
tags: [cli, scaffolding, corpus-authoring, drift-detection, stub-field, upstream-watch, packed-corpus]
test_files: [packages/core/test/cli-init.test.ts, packages/core/test/cli-scan.test.ts, packages/core/test/cli-diff.test.ts, packages/core/test/cli-pack.test.ts, packages/core/test/cli-main.test.ts]
known_issues:
  - "[deferred] Stub REJECTION is not implemented here, only stub marking and reporting. A corpus carrying `status: stub` is refused by Submission Gate [29] (Wave 5); this feature marks the fields, counts them, and reports them in `scan` and `diff` output. `pack` refusing a stub-bearing corpus is not that gate: the packed runtime format simply has no representation for a field nobody wrote."
  - "[deferred] The folklore-rule backstop (CC4 [26], Wave 5) is not built here. A twin whose `reason` and fixes are stubs has no inducing test, and nothing in this feature enforces that; it only makes the absence visible."
  - "[deferred] Upstream Watch [34]'s CI wiring (Wave 6) is not written here. `diff` exposes everything it needs (exit 1 on drift, `--json` giving a `{target, scanned_version, corpus_version, drift[], stubs[]}` report), so the lock-file/workflow side is that component's job."
  - "[deferred] No `bin` entry was added to `packages/core/package.json`: that file is outside this feature's `source_files`, 14-sdk-entry builds against the same package concurrently, and how this package assembles into the published `comprehendo` npm package is already declared a Wave 7 (Distribution) decision. The entry point exists and is invoked as `node dist/cli/main.js <verb>`; wiring the bin name is a one-line job for whoever owns that manifest."
  - "[deferred] `packed: 1` (Docs Engine [13]) has no slot for twins or fixes, so `pack` emits the docs half of the corpus only. Getting authored twins into a running provider is SDK Entry [14]'s surface, and a combined artifact, if one is ever wanted, is Corpus Format [28]'s (Wave 5) call behind its version number."
  - "[gap] The scanner is a lexer, not a type checker (see Implementation Notes for why). A symbol re-exported through a barrel, an inferred return type, and a `throw` of a variable rather than a `new X(...)` are not resolved. They surface as an absent topic or twin, never as a wrong one, and `diff` reports the absence; a target that needs more will want the compiler API in a package that is allowed to depend on it."
  - "[gap] Topic file names are lower-cased slugs, so two topics differing only in case (`Codec` and `codec`) would collide on disk. A same-bare-name collision from two different files is now disambiguated before it reaches this point (see Fixed Issues), but a case-only collision between two DIFFERENT topic name strings is not caught by that fix; a hand-added topic can still trip it."
  - "[gap] The comment-blanking lexer in `src/cli/lexer.ts` duplicates the one in `packages/core/test/helpers/source-scan.ts` (owned by 07/10/11's tests). Neither can import the other: the test helper needs `node:fs`, and src cannot import from test. Worth collapsing when something else forces one of them to change."
primitives:
  - name: "comprehendo init"
    kind: cli-verb
  - name: "comprehendo scan"
    kind: cli-verb
  - name: "comprehendo diff"
    kind: cli-verb
  - name: "comprehendo pack"
    kind: cli-verb
---

# Corpus Generator

## What to Build

Four CLI verbs that make corpus authoring start from a machine-filled
skeleton instead of a blank directory (the dts-gen precedent: a blank
directory is where contributions die). `comprehendo init` scaffolds the
five-file corpus shape. `comprehendo scan` walks the target code and
pre-fills everything a machine can know: exports and signatures from
types, docstrings as DRAFT summaries, throw/raise sites as twin skeletons
with exception types pre-filled in fingerprints, and the topic index.
`comprehendo diff` re-scans against a new version and reports drift, which
IS the upstream-watch input. `comprehendo pack` compiles the authored
corpus into the packed runtime artifact Docs Engine [13] loads. Also
serves `local` corpora for internal packages. Must-not: a re-scan never
touches human-owned fields.

## Architecture

`packages/core/src/cli/`, twelve modules and a barrel, all under the size
gate:

| Module | Job |
|---|---|
| `main.ts` | argv dispatch, usage, exit codes; the entry point |
| `init.ts` / `scan.ts` / `diff.ts` / `pack.ts` | one verb each |
| `merge.ts` | the field-ownership rule, in one place |
| `corpus-io.ts` | reading and writing the five files |
| `format.ts` | the authoring format's shapes, stub set, status derivation |
| `front-matter.ts` | the YAML subset the topic files' headers use |
| `scanner.ts` | exports, signatures, docstrings, throw sites |
| `lexer.ts` | comment blanking, bracket scanning, line numbers |
| `options.ts` / `errors.ts` | what a verb is handed, and the one error it raises |

It reads a target package's sources and writes the five-file AUTHORING
corpus this doc defines (see Data Model), and `pack` compiles that into
the `packed: 1` artifact Docs Engine [13] defined and validates the result
through 13's own `parsePackedCorpus`. Corpus Format [28] (Wave 5) is a
later, registry-scale formalization of either format; it does not exist
yet and is not this feature's target (see Fixed Issues).

## Implementation Notes

### Two formats, on purpose (the format decision)

There are two corpus formats in play and they are deliberately different:

- **The authoring format** (`corpus_authoring: 1`), defined by this
  feature: five human-edited files, the source a corpus is written in.
- **The packed runtime format** (`packed: 1`), defined by Docs Engine
  [13]: one JSON file, loaded once, never a directory walk.

`init`, `scan` and `diff` work on the first. `pack` compiles the first
into the second. The authoring format cannot BE the packed format, for
three structural reasons, each independently decisive:

1. `parsePackedCorpus` refuses a topic with an empty summary and refuses
   a topic serving no vocabulary. The defining property of `scan` output
   is that unfillable fields carry `status: stub`, so a scan that wrote
   packed JSON directly would produce, as its primary output, an artifact
   the depended-on runtime rejects.
2. `packed: 1` has no slot for twins, fixes, or throw-site fingerprints,
   which is half of what `scan` pre-fills.
3. `packed: 1` carries no field-ownership metadata, and "a re-scan never
   touches a human-owned field" needs somewhere to record which fields
   are machine-owned, which are human-owned, and which are still stubs.

`pack` is in scope rather than deferred because 13's doc states that this
feature emits the packed artifact; without `pack` that statement would be
false and 13's doc is not this feature's to edit. It is also the only
thing that proves the authoring format is SUFFICIENT to produce the
runtime format, which an authoring format nobody ever compiled is not.

### Field ownership is one rule, not per-field heuristics

Machine-owned fields (`kind`, `source`, `signatures`, twin fingerprints,
the `docs` pointer on a seeded fix, index membership) are regenerated
wholesale on every `scan`. Human-owned fields (`summary`, `see_also`,
`examples`, `vocabularies_served`, a twin's `code` and `reason`, every
fix) are written only while they are still stubs, and never again, even
when the underlying code changed. That drift is what `diff` reports.

The single rule is what makes the "byte-identical re-scan" criterion hold
and what avoids the trap in a subtler design: a docstring-derived DRAFT
summary that a human then edited would get clobbered by the next scan if
"draft" were treated as machine-owned.

Two consequences, both deliberate:

- Nothing is ever deleted. An export that disappears leaves its topic in
  place, marked `orphaned: true` (machine-owned) with its prose intact;
  same for a twin whose throw site is gone. Deleting would destroy the
  only content a machine could not have produced.
- Menu ORDER is human-curated and preserved; only membership is
  machine-derived. New topics are appended.

### Stub tracking covers publish-required fields only

`status: stub` marks `summary` on a topic, `code` and `reason` on a twin,
and `title` on a fix. Optional-by-schema fields (`see_also`, `examples`,
translations, task vocabulary) are absences, not stubs: marking them would
make every corpus permanently unfinished and drain the word of the meaning
Submission Gate [29] needs from it. `stub_fields` is derived from the
values on every write and recomputed on every read, so a hand-edited file
cannot report itself finished while carrying a stub.

### The scanner is a lexer, not the compiler API

`typescript` is a devDependency and this package carries zero runtime
dependencies (scanned in CI), so a module under `src/` importing the
compiler would make it a runtime dependency of the published core. The
scan is therefore a small self-contained lexer (comment blanking, bracket
matching, line tracking) over the target's source text, the same technique
this package's own CC1/CC9 scans use. It is honest about the limit: what
it cannot resolve it leaves absent and stub-marked rather than guessed at
(see Known Issues).

### Not enforced here

`diff` and `scan` report stubs; nothing in this feature rejects a corpus
for carrying them. That is Submission Gate [29] (Wave 5), with the
folklore rule (CC4 [26]) as its backstop, and `upstream-watch` (Upstream
Watch [34], Wave 6) is the CI side of `diff`. This feature only marks
stub fields and supports what `diff` needs.

## Data Model

### The five-file authoring corpus (`corpus_authoring: 1`)

Corpus root defaults to `<target>/comprehendo/`, `--corpus <dir>` to move
it. Every JSON file opens with `{comprehendo, corpus_authoring, provider}`.

```
comprehendo/
  manifest.json     provider identity, scanned target, manifest hint
  index.json        the topic menu, in menu order
  topics/<slug>.md  one file per topic: YAML header plus summary prose
  twins.json        one skeleton per throw site
  fixes.json        fixes, keyed by twin id, entirely human-owned
```

**manifest.json**

```json
{
  "comprehendo": "0.1",
  "corpus_authoring": 1,
  "provider": "toy-encoder",
  "target": { "package": "toy-encoder", "version": "1.0.0", "source": "src" },
  "manifest_hint": { "comprehendo": { "version": "0.1", "level": 1 } }
}
```

**index.json**: `topics` is an array of
`{topic, file, status, orphaned}` in menu order.

**topics/&lt;slug&gt;.md**: YAML header, then the summary as prose, then any
worked examples under a `## Examples` heading (`### <title>` followed by a
fenced block). A summary a scan could not fill is the single body line
`<!-- status: stub -->`.

```md
---
topic: encode
status: draft
stub_fields: []
kind: function
source: src/encode.ts:11
signatures:
  - "function encode(input: string, options?: EncodeOptions): string"
see_also: []
vocabularies_served:
  own_terms:
    - encode
  translations: []
  task: []
---

Encode a payload into the toy wire format: a decimal length prefix, a
colon, then the payload itself.
```

**twins.json**: `twins` is an array of

```json
{
  "id": "src/encode.ts#encode#RangeError#input-must-not-be-empty",
  "status": "stub",
  "stub_fields": ["code", "reason"],
  "code": "status: stub",
  "reason": "status: stub",
  "docs": "encode",
  "orphaned": false,
  "fingerprint": {
    "exception": "RangeError",
    "message_pattern": "input must not be empty",
    "source": "src/encode.ts:13",
    "raised_by": "encode"
  }
}
```

`id` is the twin's stable identity across versions and deliberately
excludes line numbers, so moving code down a file is not drift.

**fixes.json**: `fixes` maps a twin `id` to an array of
`{title, docs?, apply?, status, stub_fields}`, matching
`fix.schema.json`. A seeded fix carries only the `docs` pointer, the one
part of a fix a machine can know.

`status` on any record is `stub` (something publish-required is unwritten),
`draft` (machine-complete, human-unreviewed) or `ready` (a human said so;
preserved by re-scans until a stub reappears).

### The packed artifact `pack` emits

Exactly Docs Engine [13]'s `packed: 1` shape, validated through 13's own
loader before it is written. Empty optional arrays are omitted.

## API/Interface

`comprehendo <verb> <target-package> [flags]`

- `comprehendo init <target>`: scaffolds the five-file corpus shape.
  Refuses to overwrite an existing corpus.
- `comprehendo scan <target>`: walks the target code, pre-fills
  machine-derivable fields, marks the rest `status: stub`.
- `comprehendo diff <target>`: re-scans and reports drift. Never writes.
- `comprehendo pack <target>`: compiles the authored corpus into the
  packed runtime artifact.

Flags: `--corpus <dir>` (corpus root, default `<target>/comprehendo`),
`--src <dir>` (source directory inside the target, default `src` when it
exists), `--out <file>` (where `pack` writes, default
`<target>/comprehendo.packed.json`), `--json` (machine-readable `diff`).

Exit codes are contract, because CI reads them: `0` the verb did its job,
`1` `diff` found drift, `2` a precondition the user can fix (bad usage,
missing corpus, stubs blocking a pack), `70` a bug in the tool, reported
with its stack.

Module surface, for anything wanting the verbs as functions rather than as
a process (Upstream Watch [34] will want `diff`'s report, not its stdout):
`runInit`, `runScan`, `runDiff`, `runPack`, `computeDrift`, `packCorpus`,
`scanTarget`, `mergeScan`, `readCorpus`, `writeCorpus`, `collectStubs`,
`run`/`parseArgs` (from `packages/core/src/cli/index.ts`).

## Business Rules

- `scan` never overwrites a human-owned field (reason, fixes, summaries,
  aliases), regardless of what changed in the target code.
- Every field `scan` cannot fill is marked `status: stub`, never left
  silently blank or guessed.
- `scan` never deletes a record: a vanished export or throw site is
  marked `orphaned`, prose intact.
- `diff` never writes to the corpus, and its exit code turns on drift
  alone; stubs are reported beside it, never enforced by it.
- A corpus containing any `status: stub` field is rejected by the
  Submission Gate [29]. `pack` cannot emit one either, because the packed
  format has no representation for it.
- The same tool serves `local` corpora for internal packages, no
  separate code path: a target is a directory with a package.json.

## Acceptance Criteria

- [x] `comprehendo init` produces the five-file corpus shape for a target
      package.
- [x] `comprehendo scan` pre-fills exports/signatures/docstrings/throw
      -site skeletons and marks unfillable fields `status: stub`.
- [x] A second `scan` on unchanged human-owned fields leaves them
      byte-identical (the test asserts the whole corpus directory is
      byte-identical, which is stronger).
- [x] `comprehendo diff` reports drift against a new target-package
      version.
- [x] `comprehendo pack` emits an artifact Docs Engine [13]'s own loader
      accepts and answers queries from.

## Dependencies

- [03-shape-schemas](03-shape-schemas.md)
- [13-docs-engine](13-docs-engine.md)

## Known Issues

- [deferred] Stub REJECTION is not implemented here, only stub marking and
  reporting; Submission Gate [29] (Wave 5) owns it.
- [deferred] The folklore-rule backstop (CC4 [26], Wave 5) is not built
  here.
- [deferred] Upstream Watch [34]'s CI wiring (Wave 6) is not written here;
  `diff` exposes what it needs (exit 1 on drift, `--json` report).
- [deferred] No `bin` entry in `packages/core/package.json`: that file is
  outside this feature's `source_files` and how this package is published
  is a Wave 7 decision.
- [deferred] `packed: 1` has no slot for twins or fixes, so `pack` emits
  the docs half only.
- [gap] The scanner is a lexer, not a type checker: barrel re-exports,
  inferred return types and non-literal throws are not resolved. They
  surface as an absence, never as a wrong answer.
- [gap] Topic file names are lower-cased slugs, so two hand-added topics
  differing only in case would collide on disk.
- [gap] The comment-blanking lexer duplicates the one in
  `packages/core/test/helpers/source-scan.ts`; neither can import the
  other.

## Fixed Issues

### Three review findings (fixed 2026-08-22)

Found by review, all mutation-verified after fixing:

1. `mergeScan` keyed topics by bare export name alone, so two different
   files exporting a same-named symbol (`export function validate` in
   two modules) silently collapsed into one topic: the second export's
   signature/docstring vanished, while its own twin's `docs` pointer
   kept pointing at the surviving, unrelated topic. Contradicted this
   doc's own (and `format.ts`'s) claim that a scan cannot produce a
   name collision. Fixed: `disambiguateExports()` renames BOTH
   colliding topics to `name (file-stem)` (never just the second, so
   the result never depends on scan order) and re-points each
   colliding throw site's `docs` pointer at its own file's
   disambiguated topic.
2. A malformed target `package.json` and a hand-corrupted topic file's
   YAML front matter both surfaced as exit `70` ("a bug in this
   tool") instead of exit `2` ("a precondition the user can fix"),
   inconsistent with `corpus-io.ts`'s own `readJson`, which already
   wraps the identical failure mode for the corpus's own files. Both
   are ordinary, doc-invited user mistakes. Fixed: both now throw
   `CliError` naming the file and the parse failure.
3. `writeTopicFiles`'s stale-file cleanup crashed with `ERR_FS_EISDIR`
   on a stray subdirectory under `topics/`. Fixed: `rmSync(...,
   {recursive: true, force: true})`.

### `writeCorpus` silently dropped a hand-added `declared_schema` on the next scan (fixed 2026-08-22)

Found by Corpus Format [28]'s build (wave 5), while it was adding
`declared_schema` to `manifest.json` (the slot CC7 [09] needs to
enforce the apply grammar at the registry tier). `AuthoringCorpus` had
no field for it at all, so `readCorpus` never read a hand-added
`declared_schema` off disk, and `writeCorpus` rewrote `manifest.json`
wholesale from `{header, target, manifest_hint}` on every `scan`,
losing it. Contradicted this feature's own central rule, "a re-scan
never touches a human-owned field": `declared_schema` is exactly as
human-owned as `manifest_hint`, which the same code path already
carries through correctly.

- Fixed by giving it the identical treatment as `manifest_hint`:
  `AuthoringCorpus` gained an optional `declared_schema` field,
  `readCorpus` reads it, `writeCorpus` writes it back verbatim only
  when present, and `mergeScan` carries `existing.declared_schema`
  through untouched (never derived, never regenerated). Fixed at the
  orchestrator level (outside 28's own `source_files`, in
  `format.ts`/`corpus-io.ts`/`merge.ts`, all owned by this feature).
  Mutation-verified: 1 new test in `cli-scan.test.ts`'s "field
  ownership on a re-scan" suite, red without the fix (the field came
  back `undefined` after a re-scan), green with it.

### Doc named a Wave 5 component as this feature's file format (fixed 2026-08-22)

Was: Architecture and Data Model attributed the generated file shape to
"Corpus Format [28]", a Wave 5 component that does not exist, while
[13-docs-engine](13-docs-engine.md) had already defined and shipped a
real, versioned packed-corpus runtime format (`packed: 1`) and named this
feature as its producer. Neither statement could be built against as
written: [28] has no shape to follow, and 13's format cannot represent a
stub, a twin, or field ownership.

- Fixed by defining the five-file AUTHORING format concretely here (see
  Data Model, `corpus_authoring: 1`) as the human-edited source, upstream
  of and richer than the runtime format, and adding `comprehendo pack` as
  the compile step from one to the other, validated through 13's own
  loader. Both formats are version-gated so Corpus Format [28] can
  supersede either without a reader having to guess. The full reasoning,
  including why the alternative (scan writing packed JSON directly) is
  structurally impossible, is in Implementation Notes.

## Interface Overview

The corpus generator is the on-ramp for anyone writing a Comprehendo
corpus, native or `local`: instead of starting from an empty directory,
you get a skeleton that already knows your package's exports, signatures,
and throw sites, so writing a corpus is filling in the parts only a human
can know (why a failure happens, what fixes it), not typing out structure.

You run them in order, once each to start with, then `scan` and `diff` for
as long as the package lives. `init` makes the files, `scan` fills in
everything a machine can work out and marks the rest `status: stub` so you
can see exactly what is left for you, `diff` tells you what your package
changed out from under the corpus, and `pack` turns the finished corpus
into the single file that ships inside your package.

| Name | What it does |
|---|---|
| `comprehendo init` | Scaffolds a new five-file corpus for a target package. |
| `comprehendo scan` | Pre-fills machine-derivable fields from the target code; marks the rest `status: stub`. |
| `comprehendo diff` | Re-scans against a new version and reports what drifted. |
| `comprehendo pack` | Compiles the finished corpus into the one file the runtime loads. |

### comprehendo init

Run this once, pointed at the package you're writing a corpus for. It
creates the five-file shape (topics, twins, fixes, index, manifest hint)
ready for `scan` to fill in, and it refuses to touch a corpus that already
exists.

```sh
comprehendo init ./my-package
```

### comprehendo scan

Walks the target package's exports, types, docstrings, and throw/raise
sites, and fills in every field a machine can determine. Fields it cannot
determine are marked `status: stub` and listed at the end of the run, so
the to-do list writes itself. Safe to re-run: it never touches fields a
human has already written (reason, fixes, summaries, aliases).

```sh
comprehendo scan ./my-package
```

### comprehendo diff

Re-scans the target package at its current version and reports drift
against the existing corpus, field by field. This is the upstream-watch
input: run it after a dependency bump to see what the corpus needs
updating. It exits 1 when it found drift and never writes anything, so it
is safe in CI.

```sh
comprehendo diff ./my-package --json
```

### comprehendo pack

Compiles the corpus you have authored into the single packed file the
`docs()` runtime loads. It refuses while anything is still `status: stub`,
and names what is missing, because the packed format has no way to say
"nobody wrote this yet".

```sh
comprehendo pack ./my-package --out ./my-package/comprehendo.packed.json
```
