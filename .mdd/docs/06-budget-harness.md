---
id: 06-budget-harness
title: Budget Harness
type: COMPONENT
path: Spec / Budget Harness
source_files: [packages/spec/kit/budget/]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-1
depends_on: [02-cc5-context-budget]
tags: [tokenizer, ci-gate, budget, priming-snippet, topic-response, index-response]
test_files: [packages/spec/kit/budget/tokenizer.test.js, packages/spec/kit/budget/budgets.test.js, packages/spec/kit/budget/measure.test.js, packages/spec/kit/budget/harness.test.js]
known_issues:
  - "[deferred] The CI workflow step that invokes the harness is not written here: `.github/workflows/` is shared infrastructure outside this feature's `source_files`. The harness exposes everything the step needs (the `comprehendo-budget` bin, `npm run budget`, exit 1 on any over-budget scope, `--json` records), so wiring it is a one-line job for whoever owns the workflow."
  - "[deferred] `assertRatchet` is a tested pure function, not a git-history walker: CI supplies the previous budget table by reading `budgets.js` from the base ref. Enforcing \"the PR did not also edit the baseline\" is a CI-configuration concern and lands with the workflow step above."
---

# Budget Harness

## What to Build

The tokenizer counts wired as CI gates for CC5 Context Budget [02]: an
index-response budget, a topic-response budget, and the priming-snippet
budget (150 tokens, hard cap). The harness measures real tiktoken-class
token counts against real fixture/topic content, reports them, and fails
the build when a measured count exceeds its budget. Must-not: no
approximate word-count or character-count proxy; the budget is a real
tokenizer count.

## Architecture

Lives in `packages/spec/kit/budget/`, invoked in CI against: kit fixtures
(Wave 1, to establish the baseline numbers), Docs Engine [13] topic/index
output (Wave 2 onward), the Priming Snippet [36] (Wave 7 release gate),
and Submission Gate [29] corpus topics (Wave 5, per-corpus).

## Implementation Notes

- **The Wave-1 numeric budgets, SET (this closes the source spec's Wave-1
  open question). Fixed ceilings for every later wave, ratchet down only:**

  | Scope | Budget | Measured baseline | Baseline artifact |
  |---|---|---|---|
  | index | **1200** | 914 | `kit/budget/fixtures/index.baseline.json`, 214 topic names (the "~200 one-topic files" reference corpus scale the source spec states) |
  | topic | **600** | 383 | `kit/budget/fixtures/topic.baseline.json`, one worked topic: summary, signatures, three examples, `see_also` |
  | priming | **150** | 127 | `kit/budget/fixtures/priming.reference.md`, the RFC section 5.5 reference snippet |

  `priming` is CC5 [02]'s hard cap and is not derived from anything. The other
  two were set here, from those measurements, rounded up to clean numbers with
  bounded headroom: `budgets.test.js` asserts every limit sits between its own
  baseline and twice it, and `measure.test.js` re-measures the fixtures every
  run and goes red if a recorded baseline drifts, so the numbers can never
  quietly detach from the evidence they came from.
- Index scale was the load-bearing call: a budget set from a small toy index
  would be a one-way door forbidding the corpus size the spec itself
  prescribes, so the baseline fixture is authored at the spec's own stated
  reference scale.
- The ratchet is enforced by `assertRatchet(previous, next)` in
  `kit/budget/budgets.js`: it rejects any increase, any dropped scope, any
  non-numeric limit, and any priming value above 150 in either direction.
  `BUDGETS` is `Object.freeze`d, so nothing can raise a budget at runtime.
- tiktoken-class tokenizer: every payload is measured under BOTH declared
  encodings (`o200k_base` and `cl100k_base`) and the LARGER count is reported.
  The two disagree by real amounts ("ffmpeg" is one token under cl100k_base
  and two under o200k_base), and 150 is a hard cap, so measuring the larger
  makes "under 150 tokens" true in either accounting instead of true only
  under whichever encoder happened to be picked. Every record names the
  encoding that produced its number.
- No proxy anywhere, per the must-not: on the index baseline a word count is
  off by 5x and `chars / 4` by 15%, and `tokenizer.test.js` pins the counts
  with golden vectors plus an explicit anti-proxy assertion.
- A response object is measured as its compact serialized payload (what
  actually crosses into an agent's context); a text artifact is measured as
  its own trimmed text.
- Tooling: `packages/spec` is ESM with `node --test` and `node:assert/strict`
  (matching the repo root's existing test script), `js-tiktoken` as a DEV
  dependency, so the package still ships zero runtime dependencies and the
  spec's "spec -> nothing" one-way dependency rule is untouched.

## Data Model

Budget record: `{ scope: 'index' | 'topic' | 'priming', limit: number,
measured: number, pass: boolean }`, one record per CI run per scope. Those
four fields are present, in that order, and pinned by a test. One field is
appended, `encoding`: the tiktoken-class encoding that produced `measured`,
so a count is never ambiguous about what it counted (see the two-encoding
note in Implementation Notes).

## API/Interface

No consumer-callable surface: this is an internal CI tool, so it carries no
`primitives` and nothing in the published protocol calls it. Its entry
surface is a command, exercised live at the Green Gate:

```
node kit/budget/run.js                                 # measure the kit baselines
node kit/budget/run.js --json                          # the same, as budget records
node kit/budget/run.js --scope topic --file topic.json # measure one real artifact
npm run budget                                         # the package script
comprehendo-budget                                     # the installed bin
```

Exit codes: `0` all scopes under budget, `1` at least one scope over budget,
`2` a usage error (unknown scope, missing artifact). stdout carries the
report, stderr carries the reason a build failed, so `--json` output stays
parseable in every case.

`--scope <scope> --file <path>` is the seam every later wave uses to point
the harness at real output: Docs Engine [13] topic and index responses from
Wave 2, Submission Gate [29] corpus topics in Wave 5, the published Priming
Snippet [36] as the Wave 7 release gate.

Module exports, for CI or another gate calling it in-process:
`countTokens` / `countTokensWith` / `countTokensDetailed` (`tokenizer.js`),
`BUDGETS` / `BASELINES` / `SCOPES` / `PRIMING_HARD_CAP` / `assertRatchet`
(`budgets.js`), `measureScope` / `measureFile` / `measureBaselines` /
`renderPayload` (`measure.js`), `formatReport` / `formatFailure`
(`report.js`).

## Business Rules

- Priming snippet: hard cap 150 tokens, no exceptions.
- Topic and index budgets: numeric values are set once, here, in Wave 1,
  from measuring the kit's real examples, then only ratcheted down.
- A build with any scope over budget is red, not a warning.

## Acceptance Criteria

- [x] The harness reports index, topic, and priming token counts, on one
      line each, and returns them as records under `--json`. The gate itself
      runs and is red on any overage; the workflow step that calls it is
      `[deferred]` to whoever owns `.github/` (see Known Issues).
- [x] The priming snippet fixture measures under 150 tokens: 127.
- [x] The Wave-1 numeric topic and index budgets are recorded in this doc's
      Implementation Notes (topic 600, index 1200), live in frozen
      `kit/budget/budgets.js`, and are held as a fixed ceiling by
      `assertRatchet`.

## Dependencies

- [02-cc5-context-budget](02-cc5-context-budget.md)

## Known Issues

- [deferred] The CI workflow step that invokes the harness is not written
  here: `.github/workflows/` is shared infrastructure outside this feature's
  `source_files`. The harness exposes everything the step needs (the
  `comprehendo-budget` bin, `npm run budget`, exit 1 on any over-budget
  scope, `--json` records), so wiring it is a one-line job for whoever owns
  the workflow.
- [deferred] `assertRatchet` is a tested pure function, not a git-history
  walker: CI supplies the previous budget table by reading `budgets.js` from
  the base ref. Enforcing "the PR did not also edit the baseline" is a
  CI-configuration concern and lands with the workflow step above.

## Fixed Issues

### Exact numeric topic and index budgets were not set (fixed 2026-08-22)

The source spec's Wave-1 open question, and this component's first build
task. Closed by measuring the kit's own worked examples and fixing the
numbers from that baseline.

- Evidence: `packages/spec/kit/budget/budgets.js` (`BUDGETS`, frozen:
  index 1200, topic 600, priming 150; `BASELINES`: 914 / 383 / 127).
- Held by: `packages/spec/kit/budget/budgets.test.js` ("every budget is
  derived from the recorded Wave-1 baseline, never invented") and
  `packages/spec/kit/budget/measure.test.js` ("the recorded Wave-1
  baselines still match what the fixtures measure today").
- Live gate output: `node packages/spec/kit/budget/run.js` reports
  `index 914 / 1200`, `topic 383 / 600`, `priming 127 / 150`, exit 0.
- This also unblocks the same `[gap]` recorded on
  [02-cc5-context-budget](02-cc5-context-budget.md), which is now
  CI-enforceable with real numbers.

### Tokenizer crashed on literal special-token strings (fixed 2026-08-22)

Found by review: `tokenizer.js`'s `encode()` call used js-tiktoken's default
special-token handling, which throws when measured text contains a literal
string like `<|endoftext|>`. The harness's top-level try/catch swallowed
that into the generic usage-error exit path, so such content could never be
measured or failed-on-budget at all, indistinguishable from a CLI mistake.
Matters concretely for Wave 5's Submission Gate, which points this harness
at community-submitted corpus text.

- Fixed by passing `allowedSpecial: [], disallowedSpecial: []` to
  `encode()`, so a special-token-looking substring always counts as
  ordinary literal text (per the project's data-not-instructions rule)
  instead of throwing.
- Held by two new tests in `tokenizer.test.js`: no special string throws
  across either declared encoding, and the string is counted as its real
  BPE cost, not collapsed to a single control token.
