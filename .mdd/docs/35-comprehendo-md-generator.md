---
id: 35-comprehendo-md-generator
title: COMPREHENDO.md Generator
type: COMPONENT
path: Distribution / COMPREHENDO.md Generator
source_files: [scripts/generate-comprehendo-md.ts, scripts/comprehendo-md.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [13-docs-engine, 28-corpus-format]
tags: [comprehendo-md, generated-docs, drift-gate, file-browsing-discovery]
test_files: [packages/registry-tools/test/comprehendo-md.test.ts]
known_issues:
  - "[gap] The packed artifact carries no identity slot, so RFC 5.5's \"⟨name⟩ is ⟨one sentence: what the tool is and does⟩\" has nothing to derive from. The generated identity line states what the corpus documents (spec version, provider, authored-against version, topic/fix/failure counts, declared call surface) and never describes the tool: writing that sentence here would be exactly the hand-authored prose this feature's Business Rule forbids. Adding an identity field is Corpus Format [28]'s call."
  - "[deferred] The generator imports the BUILT modules of core and registry-tools, not their sources: node's type stripping does not remap a ./foo.js specifier onto foo.ts, so a standalone script cannot load either src/ tree at all. Consequence: dist/ is a precondition of the gate. A stale dist/ cannot pass quietly, the suite compares src and dist mtimes and fails loudly naming the build command."
  - "[deferred] The rendered file carries no fenced code blocks, so Docs As Tests [37] (which depends on this feature) will find none in it. Emitting worked examples now would commit 37 to a runner shape before it exists, and the corpus's own examples are ffmpeg command lines needing real media. 37 decides what it can execute and asks for blocks if it wants them."
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
statement, the priming pointer, and a generated summary of the corpus's
topic index, sourced entirely from the packed corpus and Docs Engine [13]
metadata, no separately-authored prose.

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
- [deferred] No fenced code blocks are rendered, which leaves Docs As
  Tests [37] nothing to execute in this file by design.
- [gap] First-sentence extraction would truncate a summary opening on an
  abbreviation. None does; the result stays deterministic either way.
