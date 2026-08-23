---
id: 36-priming-snippet
title: Priming Snippet Finalized
type: COMPONENT
path: Distribution / Priming Snippet
source_files: [packages/spec/priming.md]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [02-cc5-context-budget, 13-docs-engine]
tags: [priming-snippet, 150-token-budget, teach-any-agent, identity]
test_files: [packages/spec/test/priming-budget.test.mjs]
known_issues:
  - "[deferred] AC2 (an agent given only this snippet completes the scripted task suite) is NOT proven here. This feature makes the snippet real, measured and published; the end-to-end proof is Cold-Agent Benchmark [38]'s own acceptance criterion, run against exactly this file, and [38] owns it. Same who-proves-what split 32/33 used for the induction proofs. What IS proven here: the published text measures 144/150 tokens on the real meter and still carries all four instructions [38] needs (assertions in packages/spec/test/priming-budget.test.mjs, mutation-verified)."
  - "[gap] `comprehend(raw)` and `docs(pkg, query?)` are named in the snippet as the protocol's agent surface (CLAUDE.md's own description of the npm package, and Router & Precedence [22] implements both on `createRouter`), but `packages/core/src/index.ts` still re-exports only `./sdk.js`, so the sidecar pair is not yet reachable from the package barrel. The barrel is outside this feature's source_files. Whichever feature assembles the published `comprehendo` npm package owns that export; if it lands under different names, this snippet's third sentence is what has to change with it."
  - "[gap] `packages/spec/package.json` `files` lists only `kit`, so `priming.md` ships in the repo but not in that package's npm tarball. Harmless today (the package is `private: true`, and [38] plus the budget gate read the file from the repo), and package.json is outside this feature's source_files, so it was not edited."
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

- [x] The published priming snippet measures under 150 tokens.
      144/150 on the real js-tiktoken meter (`o200k_base` and
      `cl100k_base` both 144), iterated across ten measured
      phrasings against the actual harness (169 -> 156 -> 152 -> 148
      -> 144), never estimated. Live: `node
      packages/spec/kit/budget/run.js --scope priming --file
      packages/spec/priming.md` -> `PASS priming 144 / 150`, exit 0.
      Mutation-verified: the same file plus one padding line ->
      `FAIL priming 157 / 150 OVER BUDGET by 7`, exit 1.
- [ ] An agent given only this snippet (and nothing else about
      Comprehendo) can correctly use `comprehend`/`docs` in the
      Cold-Agent Benchmark [38] scripted suite. [deferred] Owned by
      Cold-Agent Benchmark [38], not this feature; see known_issues.
      What IS proven here: the published text carries all four
      required instructions (marker probe, `comprehend`/`docs` call
      shape, completeness contract, UNDOCUMENTED source-pass rule),
      mutation-verified by deleting two of them and confirming
      exactly 3 of 18 gate tests go red naming the missing
      instruction, restored.

## Dependencies

- [02-cc5-context-budget](02-cc5-context-budget.md)
- [13-docs-engine](13-docs-engine.md)

## Known Issues

- [deferred] AC2 is proven by Cold-Agent Benchmark [38], not here. This
  feature publishes and measures the snippet; [38] runs an agent against
  exactly this file and owns the first-correction-rate proof.
- [gap] `comprehend`/`docs` are not yet re-exported from the core package
  barrel, which is outside this feature's files. Named precisely in the
  frontmatter entry.
- [gap] `packages/spec/package.json` `files` does not list `priming.md`,
  so the artifact is repo-only, not tarball-shipped. Harmless while the
  package is private; the file is outside this feature's files.
