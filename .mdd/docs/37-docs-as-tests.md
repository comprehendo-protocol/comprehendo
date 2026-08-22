---
id: 37-docs-as-tests
title: Docs As Tests
type: COMPONENT
path: Distribution / Docs As Tests
source_files: [scripts/run-docs-code-blocks.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [35-comprehendo-md-generator]
tags: [docs-as-tests, code-block-execution, ci-gate, generated-docs]
test_files: []
known_issues: []
---

# Docs As Tests

## What to Build

Every code block in the generated documentation (`COMPREHENDO.md`, and
any other generated doc surface) executes in CI. A code example that no
longer runs is a CI failure, not a stale snippet someone notices months
later. Must-not: no doc code block ships that has not actually been run
against the real package.

## Architecture

`scripts/run-docs-code-blocks.ts`. Extracts fenced code blocks from
COMPREHENDO.md Generator [35]'s output (and any other generated docs
surface) and executes each against the built package in CI.

## Implementation Notes

- This closes the loop Principle 10 opens: generated docs stop being
  "probably still accurate" and become "provably still accurate," because
  every example in them is executed, not merely reviewed.
- Applies specifically to GENERATED docs surfaces; this is not a general
  markdown-linter, it is scoped to the docs this project generates from
  tested truth.

## Data Model

Execution record: `{ sourceFile, blockIndex, language, pass: boolean,
output }`, one per extracted code block.

## API/Interface

N/A directly; a CI job, not called by agents.

## Business Rules

- Every fenced code block in a generated doc executes in CI.
- A block that fails to execute (syntax error, runtime error, or a wrong
  result) fails CI, naming the file and block.

## Acceptance Criteria

- [ ] Every code block in the generated `COMPREHENDO.md` executes
      successfully in CI.
- [ ] A deliberately broken example (synthetic test) fails CI, proving
      the gate actually runs blocks rather than only parsing them.

## Dependencies

- [35-comprehendo-md-generator](35-comprehendo-md-generator.md)

## Known Issues

None recorded at plan time.
