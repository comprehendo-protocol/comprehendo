---
id: 36-priming-snippet
title: Priming Snippet Finalized
type: COMPONENT
path: Distribution / Priming Snippet
source_files: [packages/spec/priming.md]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [02-cc5-context-budget, 13-docs-engine]
tags: [priming-snippet, 150-token-budget, teach-any-agent, identity]
test_files: []
known_issues: []
---

# Priming Snippet Finalized

## What to Build

The finalized, published priming snippet: the roughly-one-hundred-token
text that teaches any agent the whole system (what a marker probe is,
what `comprehend`/`docs` do, the completeness contract, the pointer to
UNDOCUMENTED's permitted source pass). Measured, not estimated: CC5 [02]'s
150-token hard cap is enforced by Budget Harness [06] against the actual
published text. Must-not: the snippet never exceeds 150 tokens; it is
never a marketing description, only the operational instructions an agent
needs to use the protocol.

## Architecture

`packages/spec/priming.md` (or the equivalent published location). Built
from the identity + priming row of the Protocol Surface table and
measured by Budget Harness [06]. Consumed directly by the Cold-Agent
Benchmark [38] as the sole context an agent receives before the scripted
task suite.

## Implementation Notes

- "Roughly one hundred tokens" in the spec's prose becomes a hard,
  measured 150-token ceiling here (CC5 [02]); the snippet is written and
  then measured, iterated until it is both complete and under budget,
  never assumed to fit.
- This is the number the Wave 7 demo-state and Success Criterion 7
  actually gate on: the cold-agent benchmark is run against exactly this
  text, nothing more.

## Data Model

N/A (a finalized markdown/text artifact, not a data shape).

## API/Interface

N/A directly; this is the text an agent is given, not a function call.

## Business Rules

- The published snippet measures under 150 tokens (tiktoken-class count,
  Budget Harness [06]).
- The snippet covers: what the marker probe is, how to call
  `comprehend`/`docs`, the completeness contract, and the UNDOCUMENTED
  permitted source-pass rule. Nothing else.

## Acceptance Criteria

- [ ] The published priming snippet measures under 150 tokens.
- [ ] An agent given only this snippet (and nothing else about
      Comprehendo) can correctly use `comprehend`/`docs` in the
      Cold-Agent Benchmark [38] scripted suite.

## Dependencies

- [02-cc5-context-budget](02-cc5-context-budget.md)
- [13-docs-engine](13-docs-engine.md)

## Known Issues

None recorded at plan time.
