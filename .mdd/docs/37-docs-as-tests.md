---
id: 37-docs-as-tests
title: Docs As Tests
type: COMPONENT
path: Distribution / Docs As Tests
source_files: [scripts/run-docs-code-blocks.ts, scripts/docs-code-blocks.ts, scripts/docs-transcript-workspace.ts]
status: complete
phase: all
last_synced: 2026-08-23
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [35-comprehendo-md-generator]
tags: [docs-as-tests, code-block-execution, ci-gate, generated-docs, transcript-execution, fingerprint-routing]
test_files: [packages/registry-tools/test/docs-code-blocks.test.ts]
known_issues:
  - "[deferred] The runner does not assert that each `#` annotation line really appears in the stderr the command produced. The corpus's annotations are two different things with no mechanical separator, quoted output (`# Unknown encoder 'libx266'`) and prose commentary (`# succeeds, output carries video only`), and any rule that guesses which is which fails a CORRECT corpus. The teeth live in the fingerprint routing instead, which is machine-readable and cannot pass vacuously. Separating the two is Corpus Format [28]'s call: an example format that marked its expected output would make the check exact."
  - "[deferred] The declared workspace (`docs-transcript-workspace.ts`) is a table this feature owns, not corpus data, because nothing in the authoring format carries \"here is the media this example needs\". `test/helpers/ffmpeg-witnesses.ts` already records the same format gap for the inducing invocations. Consequence: a new example reading new media fails naming the file, which is the loud behaviour, but the fix is a code edit rather than a corpus edit."
  - "[resolved by this feature, see Fixed Issues 2026-08-23] The gate had exactly one real corpus to execute against, ffmpeg, an argv-transcript CLI; whether the runner's per-corpus iteration and per-block dispatch actually generalized past that one shape was written but unproven. corpora/openai-python (a real, importable Python package, no spawnable CLI at all) is the second real corpus, and it needed a genuinely different worked-example shape (`python`, a real script, not an argv transcript) to be tellable apart at all. See docs-transcript-workspace.ts's `invokeSource`/`requirePython` and this doc's Fixed Issues."
  - "[deferred] `ffprobe` is allowed as a companion program although the corpus's `declared_schema.surface` names only `ffmpeg`. The corpus's `inputs` topic really does use it as the diagnostic next step. The allowlist entry is declared in code with that reason rather than inferred from the text, so a corpus cannot introduce a new program by writing one into an example."
  - "[gap] The Python port's suite could not be run in the build environment (python 3.10, the package needs 3.11+ for `tomllib` and `typing.NotRequired`). This feature touches no Python, so nothing here depends on it, but the run was not green because it was not runnable."
  - "[gap] Two worked-example shapes exist now, argv transcript and Python source; a third real ecosystem shape (a JS/TS package imported and called, rather than spawned) is still unproven. Each shape has been added exactly when a real corpus needed it, never speculatively."
---

# Docs As Tests

## What to Build

Every code block in the generated documentation (`COMPREHENDO.md`, and
any other generated doc surface) executes in CI. A code example that no
longer runs is a CI failure, not a stale snippet someone notices months
later. Must-not: no doc code block ships that has not actually been run
against the real package.

## Architecture

Three files, split at the project's size gate the same way
`comprehendo-md.ts` / `generate-comprehendo-md.ts` split before them:

| Module | Job |
|---|---|
| `scripts/docs-code-blocks.ts` | pure: fence extraction, transcript parsing and tokenizing, the record shape, the report. Text in, values out. |
| `scripts/docs-transcript-workspace.ts` | the declared workspace one command runs in, the program allowlist, and the one real spawn. |
| `scripts/run-docs-code-blocks.ts` | the verdict, the corpus loading, argv, and the exit code CI reads. |

It reads the corpus through Corpus Format [28]'s REAL `parse` and routes
every real stderr through Fingerprint Index & Matcher [21]'s REAL index,
built from that corpus's own `twins.json`. Nothing is doubled and no
output is ever simulated: the subject is a program, so a program is what
runs.

Runs as a CI gate (`.github/workflows/docs-as-tests.yml`): install the
program the corpus documents, build, execute every generated surface in
`corpora/`, then run the gate's own suite.

## Implementation Notes

- This closes the loop Principle 10 opens: generated docs stop being
  "probably still accurate" and become "provably still accurate," because
  every example in them is executed, not merely reviewed.
- Applies specifically to GENERATED docs surfaces; this is not a general
  markdown-linter, it is scoped to the docs this project generates from
  tested truth.
- The hole this actually closed: `test/helpers/ffmpeg-witnesses.ts` runs a
  hand-maintained argv table that PARALLELS the worked examples in
  `corpora/ffmpeg/topics/*.md`. It never ran the example text itself, so
  until this feature nothing in CI executed the examples an agent reads.
- COMPREHENDO.md Generator [35] deliberately rendered no fenced blocks and
  deferred the decision here. It now renders the corpus's own worked
  examples, verbatim, which is what this gate executes. 35's Business Rule
  is intact: every word is still derived from the packed corpus.

## Data Model

Execution record: `{ sourceFile, blockIndex, language, pass: boolean,
output }`, one per extracted code block. `output` carries the command
lines as run, each one's real exit status, the cataloged failure its real
stderr routed to, and the last lines the program really wrote.

## API/Interface

A build-time CLI, not called by agents:

```
node scripts/run-docs-code-blocks.ts <corpus-dir> [--doc <file>]
```

`--doc` overrides the surface to execute (default
`<corpus-dir>/COMPREHENDO.md`). Module exports for the gate:
`runDocSurface(corpusDir, docFile)`, `extractBlocks`, `readTranscript`,
`reportLines`, `main(argv, out, err)`, `USAGE`.

Exit codes follow Corpus Generator [17]'s established contract: 0 every
block passed, 1 a block failed, 2 a precondition the caller can fix, 70 a
bug in this tool.

## Business Rules

- Every fenced code block in a generated doc executes in CI.
- A block that fails to execute (syntax error, runtime error, or a wrong
  result) fails CI, naming the file and block.
- A "wrong result" is defined without guessing at prose. The block's own
  heading names the cataloged failure it demonstrates, and the verdict
  comes from the corpus's own fingerprint index, run over the stderr
  regardless of exit status (exit status alone is not always reliable: a
  real ffmpeg regression makes one cataloged failure exit 0 on some
  builds, see Fixed Issues):
  - a command that exits 0 passes, UNLESS its stderr routes to EXACTLY
    the failure the block's heading names, which means the binary hit
    the claimed failure while its own exit status said nothing did;
  - a command that exits non-zero must route to a cataloged failure, and
    it must be the one the heading names;
  - a heading that names a cataloged failure must actually get it, so an
    example that quietly started working again is a wrong result;
  - a heading that names none licenses no failure: every command exits 0
    with nothing routing, a routed match at exit 0 is still a wrong
    result in reverse.
- Nothing is ever skipped. An unsupported fence language, a program off
  the allowlist, a shell metacharacter outside quotes, or media the
  declared workspace does not carry each FAIL naming the block.
- A transcript is never handed to a shell. It is tokenized and spawned as
  an argv array, so an operand can never become a command, and the program
  must be the corpus's own declared call surface or a declared companion.

## Data Flow

`corpora/<pkg>/COMPREHENDO.md` -> `extractBlocks` (fence + info-string +
nearest heading) -> `readTranscript` (command lines and `#` annotations,
tokenized) -> per command: a fresh workspace seeded from the declared
table -> real `spawnSync` of the real binary -> exit status and real
stderr -> `index.match(stderr)` through the corpus's own fingerprints ->
`BlockRecord` -> `reportLines` -> exit code.

## Dependencies

- [35-comprehendo-md-generator](35-comprehendo-md-generator.md)

## Security

The runner executes text that comes out of a corpus, so corpus text being
data and never instructions is load-bearing here rather than decorative:

- No shell, ever. Lines are tokenized in-process and spawned as an argv
  array; a line carrying `|`, `;`, `&`, a backtick, `>`, `<` or `$(`
  outside quotes is REFUSED with the character named, never approximated.
- The program is allowlisted from the corpus's own `declared_schema.
  surface` plus companions declared in code with a reason. A corpus cannot
  introduce a new program by writing one into an example.
- Every command runs in a fresh temporary workspace that is removed
  afterwards, seeded only from the declared fixture table, so an example
  cannot read or write anything in the repository.
- Fixtures are built by the documented binary itself from `lavfi`. No
  external media, no network, nothing is transmitted anywhere.

## Acceptance Criteria

- [x] Every code block in the generated `COMPREHENDO.md` executes
      successfully in CI. Proven against the real flagship surface: 15
      blocks, 37 command lines, all passing, against ffmpeg 4.4.2-0ubuntu0
      .22.04.1, in-process and across a real process boundary (exit 0).
- [x] A deliberately broken example (synthetic test) fails CI, proving
      the gate actually runs blocks rather than only parsing them.
      Mutation-verified four ways on a real copy of the real generated
      file: a filter renamed to one the build does not carry (exit 1,
      "block 8 ... routed to FFMPEG_UNKNOWN_FILTER, not the
      FFMPEG_FILTER_WITH_STREAMCOPY its heading names"), an encoder
      corrected so a failure demonstration silently succeeds, an input the
      declared workspace does not carry, and a block in a language the
      gate has no executor for. In every case exactly one block fails and
      the other fourteen still pass.

## Fixed Issues

### The runner had exactly one worked-example shape, and the second real corpus needed a different one (fixed 2026-08-23)

Found building `corpora/openai-python`, the launch corpus library's second
real corpus: this gate's whole execution model assumed a worked example is
an argv transcript against a spawnable CLI (`declared_schema.surface`
resolvable as a program, `-version` answerable, operands resolved against
a hardcoded fixture table). `openai` is a real, importable Python package
with no meaningful CLI of its own, and its real failures are provoked by a
multi-step snippet (construct a client, then call a method on it), not one
command line, the same shape `apply` cannot express either (see
corpora/openai-python's README). The corpus could not carry a single
honest worked example under the old model.

- Added a second execution shape rather than forcing the first to fit:
  `python`-language fences under `## Examples` are SOURCE blocks
  (`docs-transcript-workspace.ts#invokeSource`), the whole fence run as a
  real script against a real interpreter (`COMPREHENDO_PYTHON`, default
  `python3`), no operand parsing, matched through the exact same
  fingerprint index and `judge()` verdict logic `sh`/`console` transcripts
  already used (correctness is shared; only how the process gets spawned
  differs).
- Each shape now pays only its own precondition: `requireProgram(surface)`
  fires only when the doc carries a transcript-language block,
  `requirePython()` only when it carries a `python` block. Before this,
  ANY block unconditionally required `declared_schema.surface` to exist on
  PATH, which for openai-python meant requiring the real `openai` pip
  console-script to answer `-version` the way ffmpeg does; it does not
  (`openai -version` is a real argparse error, confirmed live), so the old
  unconditional check would have refused this corpus's docs gate outright
  with nothing in the doc actually needing that binary.
- Corpus Format [28]'s example parser now carries the author's own fence
  tag through (`CorpusExample.language`, OPTIONAL, present only when the
  fence is neither unlabelled nor explicitly `sh`) instead of the
  Generator always stamping `sh`; see 35-comprehendo-md-generator.md's own
  Fixed Issues for the budget-neutrality half of that change (an earlier,
  non-optional version of the field pushed `corpora/ffmpeg`'s own
  `docs.topics.inputs` over its CC5 [02] budget, 607/600, purely from the
  added JSON key; going optional restored it to its original measurement,
  byte-identical rendered output either way).
- `.github/workflows/docs-as-tests.yml` installs a real, pinned
  `openai>=2.35,<4` (`actions/setup-python`) alongside the existing ffmpeg
  install step, so CI actually runs this corpus's examples for real, the
  same standard every other corpus gets.
- Mutation-verified three ways: (1) reverting `SOURCE_LANGUAGES` to empty
  reproduces the original failure exactly (`language python has no
  executor in this gate, so it is not run and not skipped`, all 3
  openai-python blocks), restored, 3/3 pass; (2) reverting the optional-
  language field reproduces ffmpeg's 607/600 budget failure exactly,
  restored, budget check passes again; (3) two pre-existing
  `docs-code-blocks.test.ts` fixtures that used `python` and an unlabelled
  fence to mean "unsupported language" and "any block requires the
  program" respectively were updated to what those contracts now actually
  are (`ruby` for a genuinely still-unsupported language; a `console`
  transcript for "requires the declared program"), plus two new tests
  proving the narrower, now-correct claims each fixture used to make too
  broadly. `packages/registry-tools` 460/460, `packages/core` 548/548,
  root `index.test.js` 11/11, both corpora's docs really execute
  (`node scripts/run-docs-code-blocks.ts corpora/ffmpeg`: 15/15;
  `corpora/openai-python`: 3/3, `COMPREHENDO_PYTHON` pointed at a real
  venv with `openai==3.3.1` installed).

### The write target was never validated, letting a corpus write outside the sandbox (fixed 2026-08-23)

Found by review: `docs-transcript-workspace.ts`'s `prepare()` validated
every file a command READS against the declared `WORKSPACE` table
(`fixtureFor`), but never validated the file a writing command's final
operand names. The Security section claimed "an example cannot read or
write anything in the repository," but a corpus example ending in an
absolute path (`/tmp/x.mp4`) or a `../` traversal wrote there for real,
outside the per-command temp workspace entirely. Every real target in
the flagship corpus is a bare filename, so the bug had zero effect on
any example that ships, but nothing in the code enforced that, and
corpus text is data, never instructions, is exactly the invariant this
falsified.

- Fixed by adding `assertContainedWrite(site, name)`: refuses a write
  target that is empty is fine (nothing written), but any operand
  carrying a path separator, an absolute path, or that `resolve(site,
  name)` places outside `resolve(site)` is refused naming the operand,
  mirroring the read side's `fixtureFor` containment. Wired into
  `prepare()` immediately after the write target is computed, before
  any fixture is materialized.
- Independently reproduced both PoCs (absolute-path write, relative
  traversal write) against the real runner before the fix (both
  succeeded, confirmed via `ls` on the escape target) and after (both
  refused with "not a bare filename inside the sandboxed workspace",
  target files confirmed absent).
- Mutation-verified: two new permanent regression tests
  (`docs-code-blocks.test.ts`, describe block "a write target is never
  a path...") assert the block fails naming the reason and that the
  target file never exists on disk. Reverting just the
  `assertContainedWrite` call turns both red (`expected [] to have a
  length of 1 but got +0`, i.e. both malicious blocks silently
  "passed"); restored, green. Real corpus still 15/15 blocks passing
  against ffmpeg 4.4.2-0ubuntu0.22.04.1 after the fix. registry-tools
  375/375, core 548/548.

### The verdict trusted exit status unconditionally, which is not always true on ffmpeg 6.x (fixed 2026-08-23)

Found running the full suite on a machine with only ffmpeg 6.1.1: the
generated doc's own worked example for `FFMPEG_OUTPUT_EXISTS` (three
command lines under one heading, two demonstrating the failure and one
a genuine `-y` success as the contrast) failed, because `judge()`
treated "exit 0" as an unconditional pass, which this project's own
Business Rules text stated in as many words. ffmpeg's `>=6 <8` line
really exits 0 for this one cataloged failure while its stderr still
carries the exact cataloged line (a real ffmpeg regression, not this
project's; see [32-ffmpeg-corpus](32-ffmpeg-corpus.md) Fixed Issues).

- Fixed narrowly: exit 0 still passes in every case except one, a
  command whose real stderr routes to EXACTLY the twin the block's
  heading names. A first, broader attempt (route every exit-0 command
  through the index) broke the multi-line-per-block pattern itself
  (the `-y` success line shares its heading with the two failing
  lines, and is not supposed to route anywhere); the narrow form
  preserves every other exit-0 command's pass unchanged, licensed
  heading or not.
- The Business Rules text is corrected to state the real, narrower
  rule rather than the rule the code used to enforce.
- `corpora/ffmpeg/topics/outputs.md`'s own prose corrected from the
  now-false "still stops at exit 1" claim (trimmed to stay under the
  CC5 600-token topic budget after the addition, real tiktoken-class
  meter, verified live).
- Mutation-verified against the real generated `COMPREHENDO.md`, both
  real binaries: 28/28 on 4.4.2, 28/28 on 6.1.1.

## Known Issues

- [deferred] The `#` annotation lines are not asserted against the real
  stderr; the corpus mixes quoted output and prose commentary with no
  mechanical separator, and the teeth live in the fingerprint routing
  instead. See frontmatter.
- [deferred] The declared workspace is a table this feature owns, because
  the authoring format carries no "media this example needs" field, the
  same gap `ffmpeg-witnesses.ts` records.
- [resolved 2026-08-23] The runner's generality past ffmpeg was written
  but unproven; `corpora/openai-python`, a real Python package with no
  spawnable CLI, is the second real corpus and proved it needed a
  genuinely second worked-example shape (`python` source blocks, not argv
  transcripts) to be expressible at all. See Fixed Issues.
- [deferred] `ffprobe` is an allowlisted companion although only `ffmpeg`
  is the declared surface, declared in code with the reason.
- [gap] The Python port's suite was not runnable in the build environment
  (python 3.10 against a 3.11+ package). Nothing here touches Python.
- [gap] Two worked-example shapes exist now (argv transcript, Python
  source); a third real ecosystem shape (import-and-call, never spawned)
  remains unproven, added only when a real corpus needs it.
