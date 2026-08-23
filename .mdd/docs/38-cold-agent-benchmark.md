---
id: 38-cold-agent-benchmark
title: Cold-Agent Benchmark
type: COMPONENT
path: Distribution / Cold-Agent Benchmark
source_files: [scripts/cold-agent-benchmark.ts, scripts/cold-agent-suite.ts, scripts/cold-agent-tasks.ts, scripts/cold-agent-apply.ts, scripts/cold-agent-harness.ts, scripts/cold-agent-cc9.ts, scripts/cold-agent-live.ts]
status: planned
phase: idle
last_synced: 2026-08-23
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [36-priming-snippet, 22-router-precedence, 32-ffmpeg-corpus, 10-cc9-marker-freeze]
tags: [cold-agent-benchmark, first-correction-rate, operator-baseline, session-token-cost, release-gate]
test_files: [packages/registry-tools/test/cold-agent-benchmark.test.ts]
known_issues:
  - "[deferred] The GATING number is produced by a deterministic faithful-agent simulator, not by a language model. It proves the PROTOCOL: a faithful reader of the 144 published priming tokens has everything needed to resolve every cataloged ffmpeg failure on the first correction, with zero source reads outside an UNDOCUMENTED grant. It does NOT prove that an arbitrary model handed only that text behaves that way. That distinction is the whole reason the live tier below exists and is published separately; do not quote 14/14 as a claim about model behavior."
  - "[deferred] The LIVE tier (`--live-agent`) is a real isolated session whose entire system prompt is the bytes of packages/spec/priming.md (sha256 published with every run), but the only models reachable in this environment are local open-weights ones (llama3:8b, qwen3.5:9.7B). No provider credential exists here, and the one agent CLI on PATH was measured, not assumed: `claude -p --system-prompt <priming.md>` still carries ~34,000 characters of harness context and eleven tool definitions, so its session is not the snippet and nothing else. A frontier-model run of this same suite is a real, unfilled gap; the harness takes any OpenAI-shaped chat endpoint, so filling it is a flag, not a rebuild. See JUDGMENT-38-cold-agent-benchmark.md, call 1."
  - "[deferred] The live tier needs ONE piece of scaffolding the snippet does not supply: an action menu giving the JSON shape of the calls the snippet already names. A session with no tools has no other calling convention. The menu is asserted to name no twin code, no topic, no fix and no encoder, so it adds no Comprehendo knowledge, but it is not nothing and is named here rather than left implicit."
  - "[gap] `applyToArgv` (Corpus Format [28]'s apply grammar on a command line) exists only in packages/registry-tools/test/helpers/ffmpeg-cli.ts, a test helper no `src/` ships and a `scripts/` file loading `dist/` cannot import. scripts/cold-agent-apply.ts is a deliberate duplicate, guarded by a test asserting byte-identical argv against that helper for every fix in the real catalog on every argv in the suite. Promoting one implementation into a package's `src/` belongs to whoever owns that package, not to this feature."
  - "[deferred] sessionTokenCost moves by a few tokens between runs of the identical suite (15,150 and 15,210 observed). The cause is real: ffmpeg's own stderr carries per-run timing and speed figures, so the text that really crossed into the session really did differ. Published as measured; rounding or stripping the variable lines would make the number tidier and less true."
  - "[deferred] The Operator's baseline is a RATE (18/18 = 100%) over structured error cycles, not a task count, so this suite is derived from the corpus (12 cataloged failures + 1 clean path + 1 honest-miss path = 14) rather than padded to eighteen entries. `firstCorrectionRate` is compared against the rate; the per-kind breakdown is published beside it so the single number is never ambiguous."
  - "[gap] CC9's Python half needs an interpreter that is 3.11+ with pytest importable. `python3` on this machine is 3.10, so the gate resolves one in order (COMPREHENDO_PYTHON, packages/python/.venv, python3.13, python3.12, python3.11, python3) and FAILS naming what is missing rather than skipping. That means CI for this gate owes a Python 3.11+ toolchain, the same way [32] made CI owe a real ffmpeg."
---

# Cold-Agent Benchmark

## What to Build

The number the whole project claims: an agent given only the Priming
Snippet [36] completes a scripted task suite against wrapped tools
(ffmpeg via Router & Precedence [22] and ffmpeg Corpus [32]), with a
measured first-correction rate (target: the Operator's 100% baseline,
18/18, on structured cycles), zero source reads outside UNDOCUMENTED
grants, and published session token cost. Measured continuously, not
asserted once. Must-not: never claim a first-correction rate without a
fresh benchmark run backing it; never allow a source read outside an
UNDOCUMENTED grant to count as a pass.

## Architecture

Seven files under `scripts/`, split on the one seam that makes this
feature's own headline safety claim checkable rather than promised.

The PURE half imports no `node:` module at all, so an agent policy that
cannot open a file cannot read a package's source behind the grant's back:

- `cold-agent-suite.ts`, the session types, the faithful-agent policy, the
  per-kind scoring, and the exact text the meter bills.
- `cold-agent-tasks.ts`, the fourteen tasks as data.
- `cold-agent-apply.ts`, Corpus Format [28]'s `apply` grammar on a command
  line (a guarded duplicate, see Known Issues).

The IMPURE half does everything that touches a disk, a process, or a
network:

- `cold-agent-harness.ts`, the real consumer tree ([28]'s own `pack`, the
  corpus installed the way the registry publishes it, [22]'s own
  `discoverInstalledCorpora`) and the really-installed `ffmpeg`.
- `cold-agent-cc9.ts`, CC9 Marker Freeze [10]'s OWN scans, re-invoked as
  real subprocesses on both implementations. Never a reimplementation.
- `cold-agent-benchmark.ts`, the run, the publication, and the CLI.
- `cold-agent-live.ts`, the live isolated model session.

## Implementation Notes

- "Zero source reads outside UNDOCUMENTED grants" is a hard pass/fail
  condition, not a soft preference: any source-code read the agent makes
  that was not preceded by an UNDOCUMENTED response invalidates that run.
- This is Success Criterion 7 made executable: the benchmark script IS
  the proof, not a narrative claim in a README.
- Session token cost is published alongside the first-correction rate,
  because a 100% correction rate at ten times the token budget is not the
  same claim as one within budget (CC5 [02]).
- An ungranted source read is COUNTED AND REFUSED, never counted and
  performed. Measuring the violation is the job; opening the file would add
  nothing to the measurement while making the benchmark do the thing it
  exists to forbid.
- The correction budget is ONE. The snippet says "apply `fixes[0]`",
  singular, so a second corrective cycle is a miss rather than a slower
  success, or "first-correction" means nothing.

## Data Model

Benchmark run record: `{ runId, tasksAttempted, tasksFirstCorrected,
sourceReadsOutsideGrant, sessionTokenCost, firstCorrectionRate }`. Exactly
these six fields, asserted; the per-kind breakdown, the CC9 report, the
agent label and the transcripts are published around the record, never
folded into it.

## API/Interface

A scripted benchmark harness, not called by agents inside a real session.
Its one entry surface is the command line:

```
node scripts/cold-agent-benchmark.ts [--out <file>] [--corpus <dir>] [--live-agent [model]]
```

Exit codes are the contract, the same vocabulary [35] and [17] established:
`0` the release gate passed, `1` a business rule failed, `2` a precondition
the caller can fix (no ffmpeg, no build, no usable Python), `70` a bug in
this tool with its stack.

## Business Rules

- First-correction rate target: at or above the Operator's measured
  baseline (18/18 on structured cycles).
- Zero source reads outside an UNDOCUMENTED grant; any violation fails
  the run.
- Session token cost is published with every run, not only when it looks
  favorable.
- CC9 [10]'s marker-freeze scan re-runs and passes as part of this
  release gate.

## Acceptance Criteria

- [x] A benchmark run against the scripted ffmpeg task suite completes
      with first-correction rate at or above the Operator baseline.
      **14/14 = 100.0%** against the really-installed `ffmpeg 4.4.2-0ubuntu0.22.04.1`,
      every failure induced by ffmpeg Corpus [32]'s OWN witness argv (asserted
      entry by entry), every real stderr routed through [22]'s real
      `comprehend` over a really-installed packed corpus. Breakdown, published
      with the rate: executable-fix 3/3 (the fence and both heals really
      resolve their own failure on the first retry), inert-pointer 9/9 (the
      right twin on the first `comprehend`, and `fixes[0]`'s docs pointer
      really lands on its topic), clean 1/1, honest-miss 1/1.
      Mutation-verified: a copy of the real corpus whose heal names `copy`
      again drops the run to 13/14 and fails it naming the baseline.
- [x] Zero source reads outside UNDOCUMENTED grants across the run.
      `sourceReadsOutsideGrant: 0`, and the ONE source read that did happen is
      the granted one (a real `node_modules/toy-widgets/index.js`, opened only
      after `docs('toy-widgets', ...)` really answered `UNDOCUMENTED` with
      `source_permitted: true`). Asserted structurally as well as
      observationally: the policy is exhaustively driven over every
      observation shape and emits `read-source` if and only if the previous
      answer was UNDOCUMENTED. Mutation-verified two ways: a planted
      `read-source` in a branch with no grant behind it turns that assertion
      red, and a reckless agent run over the twelve failure tasks is caught
      12/12 with the run failing.
- [x] Session token cost is recorded and published for the run.
      **15,156 tokens** on the real js-tiktoken meter
      (`packages/spec/kit/budget/tokenizer.js`, billed at the larger of
      `o200k_base` and `cl100k_base`, the same meter every other number in
      this project uses). Recomputable from the transcript: the suite
      re-measures the published session text with an independently imported
      tokenizer and requires the identical total. Printed on failing runs too,
      asserted.
- [x] CC9 [10]'s scan passes as part of this same release-gate run.
      Both implementations, re-invoked as real subprocesses:
      `vitest run test/marker-freeze.test.ts test/marker-purity.test.ts` in
      `packages/core`, and `python -m pytest tests/test_marker_freeze.py
      tests/test_marker_purity.py` in `packages/python`. Verified to have real
      teeth by mutating the REAL marker literal
      (`Symbol.for(['compre','hendo'].join(''))` in
      `packages/core/src/marker.ts`): the gate reported
      `FAIL CC9 marker freeze, JavaScript core (exit 1)`, `RESULT fail`, and
      the benchmark exited 1. Restored, exit 0, file byte-identical.

## Dependencies

- [36-priming-snippet](36-priming-snippet.md)
- [22-router-precedence](22-router-precedence.md)
- [32-ffmpeg-corpus](32-ffmpeg-corpus.md)
- [10-cc9-marker-freeze](10-cc9-marker-freeze.md)

## Known Issues

- [deferred] The gating number measures the PROTOCOL through a deterministic
  faithful-agent simulator, not a language model. Named precisely in the
  frontmatter entry; do not quote it as a claim about model behavior.
- [deferred] The live tier is a real isolated session with a byte-verified
  system prompt, but only local open-weights models are reachable here. A
  frontier-model run of this suite is a real, unfilled gap.
- [deferred] The live tier needs one piece of scaffolding, an action menu
  giving the JSON shape of the calls the snippet already names. Asserted to
  carry no corpus knowledge, but named rather than left implicit.
- [gap] `applyToArgv` is duplicated from a test helper that no `src/` ships,
  and the duplicate is guarded by an equality test against the original.
- [deferred] `sessionTokenCost` moves by a few tokens between runs because
  ffmpeg's own stderr carries per-run timings. Published as measured.
- [deferred] The suite is 14 tasks, not 18: the Operator baseline is a rate,
  and the suite is derived from the corpus rather than padded.
- [gap] CC9's Python half needs a 3.11+ interpreter with pytest, and fails
  naming it rather than skipping. CI owes that toolchain.
