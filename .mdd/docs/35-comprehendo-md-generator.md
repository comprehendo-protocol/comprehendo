---
id: 35-comprehendo-md-generator
title: COMPREHENDO.md Generator
type: COMPONENT
path: Distribution / COMPREHENDO.md Generator
source_files: [scripts/generate-comprehendo-md.ts, scripts/comprehendo-md.ts]
status: complete
phase: all
last_synced: 2026-08-23
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [13-docs-engine, 28-corpus-format]
tags: [comprehendo-md, generated-docs, drift-gate, file-browsing-discovery]
test_files: [packages/registry-tools/test/comprehendo-md.test.ts]
known_issues:
  - "[gap] The packed artifact carries no identity slot, so RFC 5.5's \"⟨name⟩ is ⟨one sentence: what the tool is and does⟩\" has nothing to derive from. The generated identity line states what the corpus documents (spec version, provider, authored-against version, topic/fix/failure counts, declared call surface) and never describes the tool: writing that sentence here would be exactly the hand-authored prose this feature's Business Rule forbids. Adding an identity field is Corpus Format [28]'s call."
  - "[deferred] The generator imports the BUILT modules of core and registry-tools, not their sources: node's type stripping does not remap a ./foo.js specifier onto foo.ts, so a standalone script cannot load either src/ tree at all. Consequence: dist/ is a precondition of the gate. A stale dist/ cannot pass quietly, the suite compares src and dist mtimes and fails loudly naming the build command."
  - "[deferred] The `## Examples` section renders EVERY worked example the corpus carries, which took the flagship file from 39 to 167 lines. Bounded rendering (one example per topic) was considered and rejected: no rule for choosing which one exists in the corpus, so it would be arbitrary where this generator is otherwise wholly derived. The file is a browse-time discovery channel, not a `docs()` answer, so the topic-sized-answer rule is not the one that governs here; the drift gate keeps the growth honest either way."
  - "[gap] The topic row's answer is the summary up to the first sentence terminator followed by whitespace, so a summary opening on an abbreviation would render a short row. No topic in the flagship corpus does, and the result would be deterministic and drift-gated either way."
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

Two files, split at the size gate the same way `corpus-format.ts` and
`corpus-source.ts` split before them:

| Module | Job |
|---|---|
| `scripts/comprehendo-md.ts` | pure: the RFC skeletons, the renderer, the drift report. Bytes in, bytes out. |
| `scripts/generate-comprehendo-md.ts` | impure: loads the real tooling, reads and writes files, parses argv, returns the exit code. Re-exports the pure surface. |

It reads the packed corpus through Corpus Format [28]'s REAL `parse` and
`pack`, and the topic menu through Docs Engine [13]'s REAL
`parsePackedCorpus` and `createDocs`: the rendered index is what `docs()`
actually answers, not a second derivation of it, so a corpus that engine
would refuse never renders a file at all. The marker word in the priming
pointer is read off core's own frozen `COMPREHENDO_MARKER` (CC9 [10]),
never re-spelled here.

Runs as a CI gate (`.github/workflows/comprehendo-md.yml`): build, then
regenerate every corpus in `corpora/` and compare byte for byte, then run
the gate's own suite. Exit codes follow Corpus Generator [17]'s established
contract: 0 current, 1 drift, 2 a precondition the caller can fix, 70 a bug
in this tool.

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
statement, the priming pointer, a generated summary of the corpus's topic
index, and the corpus's own worked examples quoted verbatim in fenced
blocks, sourced entirely from the packed corpus and Docs Engine [13]
metadata, no separately-authored prose.

The examples section was added by Docs As Tests [37], which this feature
deferred the decision to: it executes every one of those blocks against the
real program in CI, so a worked example that stopped working is a build
failure. The fence info-string was originally a pure rendering convention
(every topic source fence was unlabelled, and this feature always stamped
`sh`); it is now the AUTHOR'S OWN fence tag, carried through unchanged
(`example.language`, Corpus Format [28]), because [37] gained a second real
execution shape (`python`, a source block run as a script rather than a
shell transcript, proven against `corpora/openai-python`) that needs to be
told apart from a transcript at render time, not guessed. `sh` stays the
default: an unlabelled source fence (every example authored before this
existed) renders identically to before, byte for byte.

## API/Interface

A build-time CLI, not called by agents:

```
node scripts/generate-comprehendo-md.ts <corpus-dir> [--check] [--out <file>]
```

No flag rewrites `<corpus-dir>/COMPREHENDO.md`; `--check` regenerates and
compares instead, exiting 1 and naming the first differing line plus the
lines only one side carries. Module exports for the gate:
`renderFromCorpus(corpusDir)`, `renderPacked(packed, index, marker)`,
`driftReport(committed, regenerated)`, `main(argv, out, err)`, `USAGE`.

## Business Rules

- `COMPREHENDO.md` content is fully derived from the packed corpus; no
  section is hand-authored independently of it.
- CI fails when the committed `COMPREHENDO.md` differs from a fresh
  regeneration.

## Acceptance Criteria

- [x] `COMPREHENDO.md` regenerates byte-identically from an unchanged
      corpus. Proven against the real flagship corpus: `corpora/ffmpeg/
      COMPREHENDO.md` is generated by this script and `--check` exits 0,
      in-process and across a real process boundary.
- [x] A corpus change that is not reflected in a regenerated
      `COMPREHENDO.md` fails CI as drift. Mutation-verified on the REAL
      corpus (`topics/codecs.md`, "for a stream" -> "for one stream"): exit
      1, the differing row named on both sides, reverted, exit 0 again. The
      suite repeats it on a real copy for an edited summary, an added topic,
      a hand-edited committed file, and a missing one.
- [x] The generated file correctly reflects the current topic index. The
      rendered rows equal, in order, what Docs Engine [13]'s real
      `createDocs(...)()` returns for the same corpus, and each row's answer
      is a strict opening slice of that topic's own summary.

## Dependencies

- [13-docs-engine](13-docs-engine.md)
- [28-corpus-format](28-corpus-format.md)

## Known Issues

- [gap] The packed artifact has no `identity` slot, so RFC 5.5's "what the
  tool is and does" sentence has nothing to derive from; the generator
  states what the corpus documents and invents nothing. See frontmatter.
- [deferred] The generator loads the BUILT modules of core and
  registry-tools; `dist/` is a precondition, and a stale one fails the
  suite loudly rather than passing.
- [deferred] The `## Examples` section renders every worked example the
  corpus carries rather than a bounded selection; no non-arbitrary rule for
  choosing exists in the corpus. See frontmatter.
- [gap] First-sentence extraction would truncate a summary opening on an
  abbreviation. None does; the result stays deterministic either way.

## Fixed Issues

### The example fence's language was always overwritten to `sh`, which stopped being true generally the moment a second corpus needed it (fixed 2026-08-23)

Found building `corpora/openai-python` (Docs As Tests [37]'s second real
worked-example shape): `EXAMPLE_LANGUAGE = 'sh'` was stamped onto every
rendered example fence unconditionally, and Corpus Format [28]'s own
example parser (`corpus-source.ts`) never captured the source topic
fence's own info-string at all, so there was no way for an author to say
"this one is a real script, not a shell transcript." A corpus whose
worked examples are Python source (openai-python) had no honest way to
render one at all.

- Fixed by carrying the author's own fence tag through: `corpus-
  source.ts`'s example regex now captures the language group,
  `CorpusExample.language` is an OPTIONAL field, and this generator
  renders `example.language ?? EXAMPLE_LANGUAGE` instead of the
  hardcoded constant.
- The field is deliberately OMITTED, never the literal `sh`, when the
  source fence was unlabelled or explicitly `sh`: CC5 [02]'s topic
  budget is measured on this exact packed JSON (`gate-budget.ts`), and
  spelling out what an unlabelled fence already meant would charge
  every example ever authored a real token cost for saying nothing new.
  Verified live: `corpora/ffmpeg`'s own generated `COMPREHENDO.md` is
  byte-identical before and after (`--check` passes), and its budget
  check, which genuinely regressed to 607/600 on `docs.topics.inputs`
  with an EARLIER, non-optional version of this fix, is back to its
  original measurement once the field went optional.
- Mutation-verified: reverting the optional-field change reproduces the
  607/600 budget failure exactly; restored, `packages/registry-tools`
  458/458, `packages/core` 548/548, both corpora's `COMPREHENDO.md`
  regenerate with zero diff from committed, and
  `scripts/run-docs-code-blocks.ts` passes both corpora for real
  (ffmpeg 15/15, openai-python 3/3, the first real proof this
  generator's fence-language field carries meaning beyond ffmpeg).

### The "invents nothing" test's mutation was incomplete, and its claim overclaimed what it proved (fixed 2026-08-22)

Found by review. `comprehendo-md.test.ts`'s "a differently-identified
corpus leaks no word of the ffmpeg one" test swapped
`manifest.provider`/`manifest.target` but left
`declared_schema.surface` (`"ffmpeg"`) untouched, so the rendered
identity paragraph still legitimately said "...over the `ffmpeg`
call surface" next to the swapped `sox`/`14.6.0` values. The
generator's own derivation was correct throughout (every field it
actually renders comes from the corpus it was handed); the test's
mutation simply didn't simulate a REAL different corpus, which would
declare its own call surface too, and its comment's "no word ...
survives" claim was broader than the two specific strings it
actually asserted.

- Fixed by swapping `declared_schema.surface` too (a realistic full
  identity mutation) and scoping the assertion to the identity
  section specifically (everything before `## Priming`), not the
  whole file: this corpus's real topic prose legitimately says
  "ffmpeg" throughout (the topics are ABOUT ffmpeg), so a whole-file
  `not.toContain('ffmpeg')` would fail on honest, corpus-derived
  content. The precise claim, now actually asserted: the part of the
  file that states what package this corpus is FOR must not still
  say ffmpeg. Mutation-verified: reverting just the `declared_schema`
  swap turns the test red, quoting the real leaked sentence; restored,
  green, 19/19.
