---
id: 32-ffmpeg-corpus
title: ffmpeg Corpus
type: COMPONENT
path: Corpora / ffmpeg / Corpus
source_files: [corpora/ffmpeg/]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-6
depends_on: [26-cc4-folklore-gate, 28-corpus-format]
tags: [ffmpeg, pitfall-catalog, fence, heal, runbook, corpus-samples, flagship]
test_files: [packages/registry-tools/test/ffmpeg-corpus.test.ts, packages/registry-tools/test/ffmpeg-induction.test.ts, packages/registry-tools/test/helpers/ffmpeg-cli.ts, packages/registry-tools/test/helpers/ffmpeg-witnesses.ts, packages/registry-tools/test/helpers/ffmpeg-corpus.ts]
known_issues:
  - "[gap] CC11 [25]'s verifyAgainstUpstream cannot verify a CLI target: it resolves installRoot/node_modules/<directory>, requires the installed manifest to declare that exact name, and then imports the module and calls its exported functions. ffmpeg is a program with argv and stderr, not a module with exports. This corpus therefore produces the SAME UpstreamVerification value from a CLI-shaped inducer (test/helpers/ffmpeg-corpus.ts, induceAll) that runs the real binary, and hands it to 29's REAL folkloreFindings and registryTruthFindings, which judge it with no tier parameter and no special case. No gate code was changed or bypassed, and no fake node_modules entry was invented for a binary that is not an npm package. A first-class CLI induction seam belongs to 25/29, not here."
  - "[gap] The authoring format has no slot for a fix's DISPOSITION (fence, heal, runbook), which is this doc's own core rule. readFixes reads title, apply, docs and confidence only, so an extra JSON key would be silently dropped on parse. The disposition is carried as a Fence:/Heal:/Runbook: prefix on the fix title and held by a test, so a fix that loses its prefix goes red."
  - "[gap] A static apply cannot reference the caller's own operand. The fence fix carries {\"-vf\": \"scale=-2:720\"}, where 720 is the cataloged invocation's target height; the general rule (-2 on any derived axis, trunc(iw/2)*2 when both are explicit) lives in the scaling topic the same fix points at, and confidence is likely rather than high for exactly this reason."
  - "[gap] CC7 [09] checks an apply's operation NAMES, never its operands, so a CLI operand is unconstrained text. That is inert only because an applier passes operands as argv elements and never through a shell (applyToArgv never shells out). The contract is written into corpora/ffmpeg/README.md rather than left implied, but nothing in the format enforces it on a future applier."
  - "[deferred] These suites REQUIRE a real ffmpeg on PATH (or COMPREHENDO_FFMPEG pointing at one) and fail loudly without one rather than skipping: CC4 [26] ships no entry a test did not provoke, and a green run that induced nothing is the folklore the rule exists to catch. Consequence: packages/registry-tools' suite now needs the binary, which this doc's Implementation Notes already anticipated (\"likely containerized\")."
  - "[deferred] The topic header's kind and source fields are TypeScript-symbol metadata with no meaning for a CLI target, and 28's parse reads neither, so this hand-authored corpus omits them rather than inventing values. 17's readCorpus would default them if it ever read this corpus."
  - "[deferred] Two real, reproducible ffmpeg failures were investigated and NOT cataloged: copying h264 into an .ogg container (the stderr on this build names no codec and no container, so a fingerprint on it would match a large family of unrelated header failures) and -t abc (real and clean, but the same shape and territory as FFMPEG_INVALID_FRAMERATE). See JUDGMENT-32-ffmpeg-corpus.md."
---

# ffmpeg Corpus

## What to Build

The flagship pitfall catalog for ffmpeg, mined from unanswered-thread
corpora (support threads, issue trackers, unanswered forum posts),
dispositioned entry by entry into fences (the mistake cannot be
expressed), heals (fixed silently and safely), or runbooks (the twin with
steps), in that preference order. Every fix induced against real ffmpeg
in CI (CC4 [26]). Seeded in part by the existing `corpus-samples/ffmpeg`
worked example (cryptic-CLI case). Must-not: no folklore entry (an
uninduced twin code or fix) ships (CC4 [26]).

Scope decision: the source spec names three worked corpus samples
(openai-python for training-lag, zod for fresh-migration, ffmpeg for
cryptic-CLI) as seeds for "the corpus file format and the registry's
first entries." This doc, and the Wave 6 build order, narrow that to
ffmpeg only, because the spec's own Build Order section commits Wave 6
explicitly and solely to the ffmpeg flagship demo. The openai-python and
zod samples remain corpus-format seed material (already used to shape
Corpus Format [28] and, for zod, the `static-pattern` fingerprint
question on Fingerprint Index & Matcher [21]) but are not built into
published registry corpora by this wave plan; authoring them is future
registry-community work, not tracked as a feature here.

## Architecture

`corpora/ffmpeg/`, in the Corpus Format [28] shape (one topic per file,
twins/fixes as JSON). Built and validated through the same Submission
Gate [29] path as any community corpus, proving one discipline for both
tiers even though this is the project's own flagship.

## Implementation Notes

- Fences and heals outrank runbooks: before writing a runbook twin for a
  cataloged ffmpeg pitfall, the corpus author asks whether the mistake
  can instead be made unexpressible (a fence) or silently corrected (a
  heal). The runbook is the fallback, not the default.
- The bulk of the wave-6 estimate (5-7 days) is this corpus-authoring
  work, deliberately staged after Wave 5's registry so the flagship
  exercises the whole submission pipeline rather than a hand-wired
  special case.
- Real CI induction against actual ffmpeg (likely containerized) is
  required for every entry; a pitfall mined from a thread but never
  reproduced does not become a catalog entry.

## Data Model

Same corpus shape as Corpus Format [28]: topic markdown files with YAML
headers, `twins.json`, `fixes.json`, specialized to ffmpeg's CLI-flag and
stderr-pattern domain.

## API/Interface

N/A directly; this corpus is consumed through `comprehend(stderr)` and
`docs('ffmpeg', query)` (Router & Precedence [22]) once installed as
`@comprehendo/ffmpeg`.

## Business Rules

- Every twin code and fix is induced against real ffmpeg in CI, never
  hand-asserted (CC4 [26]).
- Every failure is dispositioned fence, heal, or runbook, with fence and
  heal preferred over runbook.
- Every entry is mined from a real, citable pitfall source (a thread,
  issue, or the corpus-samples seed), not invented.

## Acceptance Criteria

- [x] Every cataloged ffmpeg fingerprint reproduces against real ffmpeg
      in CI. Twelve entries, twelve real runs of the really-installed
      `ffmpeg 4.4.2-0ubuntu0.22.04.1`, each one's real stderr routed
      through 21's REAL matcher built from this corpus's own twins and
      required to resolve to its own code:
      `ffmpeg-induction.test.ts`, "really fails, really writes the
      cataloged text, and really routes to itself" (12 cases). Verified to
      have teeth: loosening one `message_pattern` to `*Error*` turns 4
      tests red.
- [x] Every cataloged fix resolves its induced failure on retry, in CI.
      The three fixes carrying an `apply` are proved by applying them to
      the SAME failing argument vector and rerunning: exit 0 each time
      (`ffmpeg-induction.test.ts`, "proves each one by applying it and
      rerunning the same invocation"). Verified to have teeth: reverting
      the fence apply to the failing form turns 3 tests red. The nine
      inert docs pointers are provoked exactly when their twin is induced
      and their topic resolves, which is 29's own reading of the rule.
- [x] The corpus passes Submission Gate [29] with no folklore rejections.
      29's REAL `runSubmissionGate` over `corpora/ffmpeg/`, with the
      induction record above as its `upstream` evidence and
      `packages/spec/kit/budget`'s REAL tiktoken-class meter: all eleven
      checks `pass`, none `not-run`, zero violations, `publishable: true`.
      Verified to have teeth: adding one uninduced twin makes the gate
      name it, `folklore at ffmpeg/twins[12]`.
- [x] At least one fence and one heal exist in the catalog (not runbooks
      exclusively). One fence (`FFMPEG_ODD_DIMENSION`, `scale=-2`), two
      heals (`FFMPEG_MAP_MATCHES_NO_STREAM`, `-map 0:a?`;
      `FFMPEG_FILTER_WITH_STREAMCOPY`, `-c:v libx264`), nine runbooks.
      Both dispositions are proved as claims rather than asserted as
      labels: the fence is run over three different sources including one
      the unfenced form already handled (identical output), and each heal
      is run on the already-correct case and must leave it unchanged.

## Dependencies

- [26-cc4-folklore-gate](26-cc4-folklore-gate.md)
- [28-corpus-format](28-corpus-format.md)

## Known Issues

- [gap] CC11 [25]'s `verifyAgainstUpstream` cannot verify a CLI target: it
  resolves an installed npm package and calls its exported functions, and
  ffmpeg is a program. The same `UpstreamVerification` value is produced by
  a CLI-shaped inducer that runs the real binary, and 29's REAL folklore and
  registry-truth checks judge it unchanged. No fake `node_modules` entry was
  invented; a first-class CLI induction seam belongs to 25/29.
- [gap] The authoring format has no slot for a fix's disposition (fence,
  heal, runbook), so it is carried as a title prefix and held by a test.
- [gap] A static `apply` cannot reference the caller's own operand, so the
  fence fix carries the cataloged target height and the general rule lives
  in the topic it points at (`confidence: likely`).
- [gap] CC7 [09] checks an apply's operation names, never its operands, so
  a CLI operand is unconstrained text; it is inert only because the applier
  passes operands as argv elements and never through a shell.
- [deferred] These suites require a real ffmpeg and fail loudly without one
  rather than skipping, per CC4 [26].
- [deferred] Topic-header `kind` and `source` are omitted: they are
  TypeScript-symbol metadata with no meaning for a CLI target.
- [deferred] Two real ffmpeg failures were investigated and not cataloged
  (an ogg container copy whose stderr names nothing specific, and `-t abc`,
  which duplicates `FFMPEG_INVALID_FRAMERATE`'s shape).

## Fixed Issues

### `FFMPEG_ODD_DIMENSION`'s fingerprint covered width only, missing the equally common height case (fixed 2026-08-22)

Found by review, independently reproduced: `*width not divisible by 2
(*)*` never matched a real, equally common mirror failure, an odd
HEIGHT (`ffmpeg -f lavfi -i testsrc=size=100x301 -vf scale=50:-1 -c:v
libx264 -pix_fmt yuv420p out.mp4` really fails with `height not
divisible by 2 (50x151)`, verified live). `topics/scaling.md`'s own
prose already claimed to cover "an odd width or height", so the
fingerprint was under-inclusive relative to the corpus's own stated
claim, not the fix (`-2` already resolves both axes, verified live).

- Fixed by widening the pattern to `* not divisible by 2 (*)*`.
  Mutation-verified: reverted to the width-only form, new test goes
  red (`outcome: 'miss'`); restored, green.

### `FFMPEG_INPUT_NOT_FOUND`'s pattern also matches a missing OUTPUT directory, and the twin overclaimed which one occurred (fixed 2026-08-22)

Found by review, independently reproduced: `ffmpeg` prints the
IDENTICAL `<path>: No such file or directory` shape whether the
missing path is an input or an output directory (verified live,
`ffmpeg -i clip.mp4 -y nonexistentdir/out.mp4` fails the same way, on
the output). The corpus format's literal-plus-wildcard pattern
language cannot distinguish the two: ffmpeg's own message never names
which argument the path came from, and no earlier context in the
captured stderr (`-hide_banner`/`-nostdin` per this corpus's own
induction convention) reliably separates them either. The twin's
`reason` and the fix's `title` both confidently said "input", which
would misdirect a caller hitting the output-path variant.

- Fixed by correcting the claim rather than attempting a false
  -precision pattern trick: the twin's `reason`, the fix's `title`,
  and the `inputs` topic's prose all now say plainly that this
  message can mean either an input or an output path, name the
  output-directory case explicitly, and tell the caller to check
  both, input first. The pattern itself is unchanged (intentionally
  loose, now honestly documented as such) since no honest tightening
  exists. A new test pins this as disclosed, tested behavior: the
  output-directory case is asserted to genuinely route to
  `FFMPEG_INPUT_NOT_FOUND` (not a bug, the corpus's own honesty
  claim), so a future change to either the pattern or the claim has
  to update both together.
- `topics/inputs.md` tightened elsewhere to stay under the CC5
  600-token topic budget after the addition (real tiktoken-class
  meter, verified live via `runSubmissionGate`).
