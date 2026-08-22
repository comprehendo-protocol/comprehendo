---
id: 02-cc5-context-budget
title: CC5 Context Budget
type: SPEC
path: Spec / Cross-Cutting Contracts / Context Budget
source_files: []
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-1
depends_on: []
tags: [context-budget, tokenizer, priming-snippet, docs-index, ci-gate]
test_files: []
known_issues: []
---

# CC5 Context Budget

## What to Build

A contract, not code: index responses, topic responses, and the priming
snippet are tokenizer-measured in CI against fixed budgets. Priming is
capped at 150 tokens; topic and index budgets are set in Wave 1 (one of
the Wave-1 open design questions, see the `comprehendo` initiative's Open
Questions) and only ever ratcheted down afterward, never up. A corpus with
an oversized topic does not publish.

## Architecture

Enforced by the Budget Harness [06] (tiktoken-class tokenizer counts wired
as CI gates), first exercised in Wave 1 against the kit's own fixtures,
then re-enforced continuously: Docs Engine [13] topic/index responses, the
Priming Snippet [36] finalized in Wave 7, and the Submission Gate [29]
which rejects an oversized registry-corpus topic at gate time.

## Implementation Notes

- Budgets are measured, not asserted: every CI run that touches a topic,
  an index, or the priming snippet re-tokenizes it and compares against
  the fixed budget.
- "Only ratcheted down" is a one-way door: once Wave 1 sets the topic and
  index budgets, a later wave may tighten them but a PR that would loosen
  a budget is itself a violation of this contract.
- Wave 7 (`comprehendo-md-generator`, `priming-finalized`) re-enforces this
  SPEC as a release gate, not a new implementation.

## Data Model

N/A (a SPEC; the harness that measures it is Budget Harness [06]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- Priming snippet: hard cap 150 tokens, tiktoken-class count.
- Topic response: one topic-sized answer per query, budget fixed in Wave 1.
- Index response: names only, budget fixed in Wave 1.
- A registry corpus PR whose topic exceeds budget is rejected by the
  Submission Gate [29] naming the violation, not silently truncated.

## Acceptance Criteria

- [ ] The Budget Harness [06] runs in CI and reports index, topic, and
      priming token counts on every relevant change.
- [ ] The priming snippet measures under 150 tokens (Wave 7 release gate).
- [ ] A fixture or corpus exceeding its budget fails CI with the specific
      count and the budget it exceeded, never a silent pass.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None open.

## Fixed Issues

### Exact topic and index token budgets were not yet numeric (fixed 2026-08-22)

Was: the exact topic and index token budgets were an explicit Wave-1 open
question in the source spec, not yet numeric, so this contract could not be
CI-enforced with real numbers.

- Fixed by [06-budget-harness](06-budget-harness.md): index 1200 (baseline
  914), topic 600 (baseline 383), priming 150 (baseline 127, CC5's own hard
  cap), each held by `assertRatchet` in `packages/spec/kit/budget/budgets.js`
  and re-measured against real fixtures every run.
