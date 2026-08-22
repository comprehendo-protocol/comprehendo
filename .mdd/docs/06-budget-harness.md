---
id: 06-budget-harness
title: Budget Harness
type: COMPONENT
path: Spec / Budget Harness
source_files: [packages/spec/kit/budget/]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-1
depends_on: [02-cc5-context-budget]
tags: [tokenizer, ci-gate, budget, priming-snippet, topic-response, index-response]
test_files: []
known_issues: []
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

- This is the component that actually SETS the numeric topic and index
  budgets (an explicit Wave-1 open question in the source spec): it
  measures the kit's own worked examples and picks fixed budgets from
  that baseline, then CI only ever ratchets them down.
- tiktoken-class tokenizer: matches the encoding used by the model
  ecosystem this project targets, so a "150 tokens" claim means the same
  thing an agent's own context accounting means.

## Data Model

Budget record: `{ scope: 'index' | 'topic' | 'priming', limit: number,
measured: number, pass: boolean }`, one record per CI run per scope.

## API/Interface

N/A as a consumer-callable surface (an internal CI tool); its output is
consumed by the CI pipeline, not by agents or provider code.

## Business Rules

- Priming snippet: hard cap 150 tokens, no exceptions.
- Topic and index budgets: numeric values are set once, here, in Wave 1,
  from measuring the kit's real examples, then only ratcheted down.
- A build with any scope over budget is red, not a warning.

## Acceptance Criteria

- [ ] The harness reports index, topic, and priming token counts for every
      CI run that touches those surfaces.
- [ ] The priming snippet fixture measures under 150 tokens.
- [ ] The Wave-1 numeric topic and index budgets are recorded (in this
      doc's Implementation Notes, updated when set) and used as the fixed
      ceiling by every later wave.

## Dependencies

- [02-cc5-context-budget](02-cc5-context-budget.md)

## Known Issues

- [gap] Exact numeric topic and index budgets are not yet set; this
  component's first build task is establishing them from the kit's
  baseline fixtures, per the source spec's Wave-1 open question.
