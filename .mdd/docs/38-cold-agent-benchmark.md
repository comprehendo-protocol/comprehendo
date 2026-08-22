---
id: 38-cold-agent-benchmark
title: Cold-Agent Benchmark
type: COMPONENT
path: Distribution / Cold-Agent Benchmark
source_files: [scripts/cold-agent-benchmark.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [36-priming-snippet, 22-router-precedence, 32-ffmpeg-corpus, 10-cc9-marker-freeze]
tags: [cold-agent-benchmark, first-correction-rate, operator-baseline, session-token-cost, release-gate]
test_files: []
known_issues: []
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

`scripts/cold-agent-benchmark.ts`. Drives a fresh agent session with only
the Priming Snippet [36] as context, against the scripted task suite over
ffmpeg (the flagship, Wave 6), through Router & Precedence [22]'s
`comprehend`/`docs` surface. Re-verifies CC9 Marker Freeze [10] as part of
the release-gate run (a computed or aliased marker would itself break the
benchmark's premise that priming alone is sufficient).

## Implementation Notes

- "Zero source reads outside UNDOCUMENTED grants" is a hard pass/fail
  condition, not a soft preference: any source-code read the agent makes
  that was not preceded by an UNDOCUMENTED response invalidates that run.
- This is Success Criterion 7 made executable: the benchmark script IS
  the proof, not a narrative claim in a README.
- Session token cost is published alongside the first-correction rate,
  because a 100% correction rate at ten times the token budget is not the
  same claim as one within budget (CC5 [02]).

## Data Model

Benchmark run record: `{ runId, tasksAttempted, tasksFirstCorrected,
sourceReadsOutsideGrant, sessionTokenCost, firstCorrectionRate }`.

## API/Interface

N/A directly; a scripted benchmark harness, not called by agents inside a
real session.

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

- [ ] A benchmark run against the scripted ffmpeg task suite completes
      with first-correction rate at or above the Operator baseline.
- [ ] Zero source reads outside UNDOCUMENTED grants across the run.
- [ ] Session token cost is recorded and published for the run.
- [ ] CC9 [10]'s scan passes as part of this same release-gate run.

## Dependencies

- [36-priming-snippet](36-priming-snippet.md)
- [22-router-precedence](22-router-precedence.md)
- [32-ffmpeg-corpus](32-ffmpeg-corpus.md)
- [10-cc9-marker-freeze](10-cc9-marker-freeze.md)

## Known Issues

None recorded at plan time.
