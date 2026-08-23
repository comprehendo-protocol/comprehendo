# Judgment log: 32-ffmpeg-corpus

Every call made while building the flagship ffmpeg corpus, and the induction
record every cataloged entry rests on. Nothing below is remembered: each stderr
line was produced by running the command against the real binary in this
environment and copying what it printed.

Binary: `ffmpeg version 4.4.2-0ubuntu0.22.04.1`, libavcodec 58.134.100,
built with `--enable-libx264`, `--enable-gpl`. `ffprobe` from the same build.

---

## 1. Induction record

Twelve cataloged failures, twelve real runs. Every source is synthetic, so
none of these needs an external media file. Fixture files named below
(`clip.mp4`, `video-only.mp4`, `av.mp4`, `exists.mp4`, `notes.txt`) are built
in the same temp directory by ffmpeg itself, or written as plain text.

| # | Code | Command run | Real stderr line | Exit |
|---|---|---|---|---|
| 1 | `FFMPEG_INPUT_NOT_FOUND` | `ffmpeg -i does-not-exist.mp4 out.mp4` | `does-not-exist.mp4: No such file or directory` | 1 |
| 2 | `FFMPEG_INVALID_INPUT_DATA` | `ffmpeg -i notes.txt out.mp4` | `notes.txt: Invalid data found when processing input` | 1 |
| 3 | `FFMPEG_OUTPUT_EXISTS` | `ffmpeg -nostdin -f lavfi -i testsrc=size=64x64:duration=1 -c:v libx264 -pix_fmt yuv420p exists.mp4` | `File 'exists.mp4' already exists. Exiting.` | 1 |
| 4 | `FFMPEG_NO_OUTPUT_FILE` | `ffmpeg -i clip.mp4` | `At least one output file must be specified` | 1 |
| 5 | `FFMPEG_ODD_DIMENSION` | `ffmpeg -f lavfi -i testsrc=size=1442x1440:rate=5:duration=1 -vf scale=-1:720 -c:v libx264 -pix_fmt yuv420p -y out.mp4` | `[libx264 @ 0x...] width not divisible by 2 (721x720)` | 1 |
| 6 | `FFMPEG_MAP_MATCHES_NO_STREAM` | `ffmpeg -i video-only.mp4 -map 0:v -map 0:a -c copy -y out.mp4` | `Stream map '0:a' matches no streams.` (plus `To ignore this, add a trailing '?' to the map.`) | 1 |
| 7 | `FFMPEG_UNKNOWN_ENCODER` | `ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -c:v libx266 -y out.mp4` | `Unknown encoder 'libx266'` | 1 |
| 8 | `FFMPEG_FILTER_WITH_STREAMCOPY` | `ffmpeg -i clip.mp4 -vf scale=160:120 -c:v copy -y out.mp4` | `Filtergraph 'scale=160:120' was defined for video output stream 0:0 but codec copy was selected.` / `Filtering and streamcopy cannot be used together.` | 1 |
| 9 | `FFMPEG_UNKNOWN_FILTER` | `ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -vf notafilter=1 -y out.mp4` | `[AVFilterGraph @ 0x...] No such filter: 'notafilter'` | 1 |
| 10 | `FFMPEG_UNDEFINED_FILTER_LABEL` | `ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -filter_complex "[0:v]scale=32:32[v]" -map "[vv]" -y out.mp4` | `Output with label 'vv' does not exist in any defined filter graph, or was already used elsewhere.` | 1 |
| 11 | `FFMPEG_INVALID_FRAMERATE` | `ffmpeg -f lavfi -i testsrc=size=64x64:duration=1 -r not-a-number -y out.mp4` | `Invalid framerate value: not-a-number` | 1 |
| 12 | `FFMPEG_UNRECOGNIZED_OPTION` | `ffmpeg -i clip.mp4 -vcodex libx264 -y out.mp4` | `Unrecognized option 'vcodex'.` / `Error splitting the argument list: Option not found` | 1 |

### Fix retries, run live

| Fix | Corrected command | Result |
|---|---|---|
| Fence on #5 | `-vf scale=-2:720` on the same 1442x1440 source | exit 0, `ffprobe` reports `722,720` |
| Heal on #6 | `-map 0:v -map 0:a?` on `video-only.mp4` | exit 0, output carries `video` only |
| Heal on #8 | `-c:v libx264` in place of `-c:v copy` | exit 0 |

### Fence generality, run live over three sources

| Source | `scale=-1:50` | `scale=-2:50` |
|---|---|---|
| 202x100 | exit 1, `width not divisible by 2 (101x50)` | exit 0, `102,50` |
| 302x100 | exit 1, `width not divisible by 2 (151x50)` | exit 0, `152,50` |
| 606x400 | exit 0, `76,50` | exit 0, `76,50` (identical) |

### Heal safety, run live

| Case | Unmarked form | Healed form |
|---|---|---|
| `av.mp4` (audio present), `-map 0:v -map 0:a` | exit 0, streams `video, audio` | `-map 0:v -map 0:a?` exit 0, streams `video, audio` (identical) |
| no filtergraph, plain remux | exit 0 | `-c:v libx264` exit 0, stream `video` |

### Also verified before being written into a topic (so no example is folklore)

- `-vf scale=trunc(iw/2)*2:trunc(ih/2)*2` on a 101x101 source: exit 0, output
  `100,100`; the same source without it: `width not divisible by 2 (101x101)`.
- `-n` against an existing output: the SAME line, `File 'exists.mp4' already
  exists. Exiting.`, and still exit 1. `-y`: exit 0 and the file is replaced.
  The `outputs` topic says so explicitly, because the obvious reading (that
  `-n` is the safe way to keep going) is wrong.
- `-r 30000/1001`: exit 0, so the ratio form named in the `options` topic is
  real.
- `-map "[v]"` with the label the graph defines: exit 0.
- `ffprobe notes.txt`: `notes.txt: Invalid data found when processing input`,
  which is why the `inputs` topic points at ffprobe to settle case 2.

Candidates investigated and DROPPED rather than cataloged:

- copy an h264 stream into an `.ogg` container. It does fail (exit 1), but on
  this build the only lines are `Could not write header for output file #0
  (incorrect codec parameters ?): Invalid argument` and `Error initializing
  output stream 0:0 --`, with no codec or container named. A fingerprint on
  that text would match a large family of unrelated header failures, so it is
  not cataloged. Dropped for pattern quality, not for truth.
- `-t abc` (`Invalid duration specification for t: abc`). Real and clean, but
  the same territory and shape as `FFMPEG_INVALID_FRAMERATE`; left out to keep
  the catalog tight rather than padded.

---

## 2. Disposition calls, entry by entry

The three dispositions were given testable definitions first, because "fence"
and "heal" are otherwise labels an author can apply to anything:

- **Fence**: after the correction, the failure class cannot be expressed for
  ANY input. Evidence owed: the corrected form run over several different
  inputs, including one the uncorrected form already handled, which must come
  out identical.
- **Heal**: the specific failing invocation is corrected silently and safely,
  and the correction changes nothing about a command that already worked. The
  failure class survives (another invocation can still make the mistake).
  Evidence owed: the failing case resolved AND the already-correct case
  unchanged.
- **Runbook**: neither is honestly available, usually because the correction
  is a decision only the caller can make. The fix is an inert docs pointer.

| Entry | Disposition | Why not the stronger one |
|---|---|---|
| `FFMPEG_ODD_DIMENSION` | **Fence** | `-2` derives exactly as `-1` does and rounds to a multiple of two, so odd is arithmetically unreachable for every source dimension and every target size. Proved over three sources. |
| `FFMPEG_MAP_MATCHES_NO_STREAM` | **Heal** | Not a fence: `?` makes THIS specifier optional, and the next unmarked `-map` can still abort. Safe because the output is identical when the stream is present, which was run. |
| `FFMPEG_FILTER_WITH_STREAMCOPY` | **Heal** | Not a fence: naming an encoder fixes this invocation, and nothing stops the next one pairing `-vf` with `-c copy`. Safe, but it converts a remux into a re-encode, so the second fix is the opposite answer (drop the filter) for callers who only wanted a container change. |
| `FFMPEG_OUTPUT_EXISTS` | **Runbook** | A heal here means `-y`, which destroys whatever is at that path, and `-n` does not resolve the failure at all (verified: same message, same exit 1). Auto-overwriting is not "safe", so the honest answer is a decision, not a correction. The gate's danger lint independently flags `-y` in an apply, which agrees. |
| `FFMPEG_INPUT_NOT_FOUND` | Runbook | No correction exists without knowing the intended path. |
| `FFMPEG_INVALID_INPUT_DATA` | Runbook | The file is the problem; nothing in the command can be rewritten. |
| `FFMPEG_NO_OUTPUT_FILE` | Runbook | The missing operand is the caller's, and inventing an output path is a write to a path nobody named. |
| `FFMPEG_UNKNOWN_ENCODER` | Runbook | Substituting a different encoder silently changes the codec of the result. |
| `FFMPEG_UNKNOWN_FILTER` | Runbook | No safe guess at which filter was meant. |
| `FFMPEG_UNDEFINED_FILTER_LABEL` | Runbook | The message covers two different mistakes and the correction differs per graph. |
| `FFMPEG_INVALID_FRAMERATE` | Runbook | A default frame rate is a guess about the caller's intent. |
| `FFMPEG_UNRECOGNIZED_OPTION` | Runbook | Correcting a typo means guessing which option was meant. |

Result: 1 fence, 2 heals, 12 runbook-shaped docs pointers across 12 entries
(the fence and both heals also carry a second, runbook fix). The doc's
acceptance criterion (at least one fence and one heal, not runbooks
exclusively) is met by evidence rather than by labelling.

**Fence considered honestly for every entry, and refused for eleven.** A fence
in the strict sense (the mistake cannot be expressed) usually needs a wrapper
that owns the call surface, and this corpus wraps nothing: comprehendo does not
sit between the caller and `ffmpeg`. `FFMPEG_ODD_DIMENSION` is the exception
only because ffmpeg's own option surface already contains a form (`-2`) that
makes the mistake arithmetically unreachable, so the fence is the provider's,
and the corpus's job is to name it.

---

## 3. Judgment calls

**J1. Hand-authored, not generated.** Corpus Generator [17]'s `init`/`scan`
walks a target package's TypeScript exports and throw sites. ffmpeg has no
exports and no throw sites; it has argv and stderr. So the five files were
written by hand in [28]'s authoring shape. Decided (not blocking) because the
format is a data contract and the JUDGING is what has to stay shared: the
corpus is read by 28's real `parse`, judged by its real `validate`, compiled by
its real `pack`, and gated by 29's real `runSubmissionGate`.

**J2. Real tests, not `expect.fail` skeletons, at the Red Gate.** The build
skill's Phase 4 asks for placeholder skeletons. Both suites were written as the
real thing instead and confirmed red before the corpus existed (`CorpusFormatError:
the corpus at .../corpora/ffmpeg carries no manifest.json`, 0 of 37 passing).
A test that fails for the reason it will later pass for is a stronger red than
a placeholder, and the gate's requirement (every new test fails) is met.

**J3. A missing ffmpeg fails the suite, it never skips it.** CC4 says an entry
is provoked by a test that actually triggers the failure. A suite that
self-skips on a machine without the binary would report green having verified
nothing, which is the folklore the rule exists to catch. `requireFfmpeg()`
throws and names what CI owes. Cost, recorded honestly: `packages/registry-tools`'s
suite now requires a real ffmpeg on PATH (or `COMPREHENDO_FFMPEG`). Recorded in
the feature doc's Known Issues so the wave owner sees it rather than
discovering it.

**J4. Tests live in `packages/registry-tools/test/`.** New files only, no
existing file edited. That package already carries the corpus tooling, a vitest
runner, and the precedent for spawning a child process in a test
(`test/helpers/gate-fixture.ts` spawns npm). CC6's no-`child_process` scan
reads `src/` only, which was checked in `packages/core/test/no-telemetry.test.ts`
before writing a line. A separate corpus-local test package would have needed
its own dependency install for no gain.

**J5. `verifyAgainstUpstream` is NOT used, and a fake node_modules entry was
NOT invented for ffmpeg.** That function resolves
`installRoot/node_modules/<directory>`, requires the installed manifest to
declare that exact name, and then imports the module and calls its exported
functions. ffmpeg is not an npm package and has no exports. Two options were
available: fabricate `node_modules/ffmpeg/package.json` so the resolver is
satisfied, or produce the same `UpstreamVerification` value from a CLI-shaped
inducer. The first ships a lie inside the evidence the folklore gate reads, so
the second was chosen: `test/helpers/ffmpeg-corpus.ts`'s `induceAll` runs the
real binary and returns the same record, which 29's REAL `folkloreFindings` and
`registryTruthFindings` then judge. No gate code was modified or bypassed.
Recorded as a Known Issue, since it is a real gap in the gate, not a quirk of
this corpus.

**J6. The apply grammar on a command line.** [28]'s `apply` is
`{operation: operand}` and CC7 checks that every top-level key is a declared
operation. For a CLI the operations are ffmpeg's own option names, so
`{"-vf": "scale=-2:720"}` is literal call data shaped exactly like the call
surface. One semantic had to be settled that a module surface never raises:
`-map` is repeatable, so "replace the operand" is ambiguous. Settled as: a
string operand means the option occurs once, an array operand means the
option's occurrences are exactly those in that order, which is the same reading
`gate-induce.ts`'s `readCalls` already gives an array operand. The applier
removes existing occurrences and inserts before the output path.

**J7. Operand text is unconstrained, and that is safe only because of the
applier.** CC7 checks operation NAMES. Nothing checks an operand, so a corpus
could put shell metacharacters in one. This is inert when the applier passes
operands as argv elements, and a real hole if an applier ever builds a command
string. `applyToArgv` never shells out, and the contract is written into
`corpora/ffmpeg/README.md` rather than left implied. Recorded as a Known Issue
because it is a property of the format, not of this corpus.

**J8. Fingerprints declare `message_pattern` and no `exception`.**
`fingerprint-facets.ts`'s `observe` reads a bare string as the message with no
error class, and `judge` counts a declared-but-unconfirmable facet as REJECTED.
An `exception` on a CLI entry would therefore reject every real match. Asserted
as a test rather than left as a comment.

**J9. The fence and heal applies carry cataloged operands, at confidence
`likely`.** `{"-vf": "scale=-2:720"}` hard-codes the 720 the cataloged
invocation requested, because static call data cannot reference the caller's
own value. The general rule (`-2` on any derived axis, `trunc(iw/2)*2` when
both are explicit) lives in the `scaling` topic, which the same fix points at.
`confidence` is `likely` rather than `high` for exactly this reason. Recorded
as a Known Issue: the format has no way to express "reuse the operand the
caller supplied".

**J10. The disposition is carried in the fix title.** The authoring format has
no field for fence/heal/runbook, which is doc 32's own core rule, so the
titles are prefixed `Fence:`, `Heal:` and `Runbook:`. An extra JSON key would
have been silently dropped by `readFixes` (it reads title, apply, docs,
confidence only) and become drift. Held by a test, so a fix that loses its
prefix goes red. Recorded as a Known Issue.

**J11. `kind` and `source` omitted from topic headers.** 17's topic header
carries `kind` (a TypeScript symbol kind) and `source` (a source file). Neither
means anything for a CLI target and 28's `parse` reads neither. Inventing
values would have been fabricated metadata, so they are absent. Consequence,
recorded: 17's `readCorpus` would default them if it ever read this corpus.

**J12. Twelve entries, seven topics.** Chosen for coverage of the territory an
agent actually hits (inputs, outputs, options, codecs, filters, scaling,
stream selection) with every entry distinct enough to fingerprint on its own.
Two further real, reproducible failures were dropped (see the induction record)
rather than padding the count.

**J13. Three topics were rewritten to fit the CC5 topic budget.** `filters`
(630), `scaling` (643) and `stream-selection` (605) came in over the 600-token
topic budget, reported by the real gate with the real tiktoken-class meter.
Prose was tightened and two examples merged. No content that carried evidence
was cut.

**J14. The doc's `known_issues` and `test_files` were written; `status` and
`phase` were not touched.** The findings are what the orchestrator asked for in
writing, and `test_files` is the honest record of what this build wrote. Status
flips and the wave bookkeeping are the orchestrator's.

---

## 4. Verification that the tests have teeth

Three mutations, each reverted after the run:

| Mutation | Result |
|---|---|
| `FFMPEG_ODD_DIMENSION`'s pattern loosened to `*Error*` | 4 tests red (two witnesses stop routing to themselves, the induction record and the gate both fail) |
| The fence apply changed back to `scale=-1:720` | 3 tests red, including "proves each one by applying it and rerunning the same invocation" |
| A thirteenth twin added with no witness | 3 tests red, and the real gate names it: `folklore at ffmpeg/twins[12] (folklore-entry): the inducing run for FFMPEG_REMEMBERED_BUT_NEVER_RUN never observed it` |

---

## 5. Nothing was blocked

The one thing that could have blocked (CC7 being unable to express a CLI
provider's call schema at all, making every fix un-schema-boundable) does not
hold: `declared_schema` takes the option names, `validateApply` checks them,
and both core's `validateCatalog` and registry-tools' `validate` accept the
result. The gaps that remain are named in Known Issues, and none of them
required guessing past a contradiction.
