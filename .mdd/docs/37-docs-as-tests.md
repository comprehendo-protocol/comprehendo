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
  - "[gap] The gate has exactly one generated docs surface to execute, `corpora/*/COMPREHENDO.md`. It is written for any generated surface and iterates every corpus in the tree, but no second generator exists yet to prove that generality against."
  - "[deferred] `ffprobe` is allowed as a companion program although the corpus's `declared_schema.surface` names only `ffmpeg`. The corpus's `inputs` topic really does use it as the diagnostic next step. The allowlist entry is declared in code with that reason rather than inferred from the text, so a corpus cannot introduce a new program by writing one into an example."
  - "[gap] The Python port's suite could not be run in the build environment (python 3.10, the package needs 3.11+ for `tomllib` and `typing.NotRequired`). This feature touches no Python, so nothing here depends on it, but the run was not green because it was not runnable."
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
  heading names the cataloged failure it demonstrates, and the verdict on
  a non-zero exit comes from the corpus's own fingerprint index:
  - a command that exits 0 passes;
  - a command that exits non-zero must route to a cataloged failure, and
    it must be the one the heading names;
  - a heading that names a cataloged failure must actually get it, so an
    example that quietly started working again is a wrong result;
  - a heading that names none licenses no failure: every command exits 0.
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

## Known Issues

- [deferred] The `#` annotation lines are not asserted against the real
  stderr; the corpus mixes quoted output and prose commentary with no
  mechanical separator, and the teeth live in the fingerprint routing
  instead. See frontmatter.
- [deferred] The declared workspace is a table this feature owns, because
  the authoring format carries no "media this example needs" field, the
  same gap `ffmpeg-witnesses.ts` records.
- [gap] Only one generated docs surface exists to execute against, so the
  runner's generality over other surfaces is written but unproven.
- [deferred] `ffprobe` is an allowlisted companion although only `ffmpeg`
  is the declared surface, declared in code with the reason.
- [gap] The Python port's suite was not runnable in the build environment
  (python 3.10 against a 3.11+ package). Nothing here touches Python.
