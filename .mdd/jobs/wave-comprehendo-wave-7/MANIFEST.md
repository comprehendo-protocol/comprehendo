# Wave job manifest: comprehendo-wave-7

mode: unattended
branch: wave/comprehendo-wave-7
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 2): 35-comprehendo-md-generator (dep 13, 28, both complete; new file scripts/generate-comprehendo-md.ts), 36-priming-snippet (dep 02, 13, both complete; new file packages/spec/priming.md)
- batch 2 (parallel, 3): 37-docs-as-tests (dep 35; new file scripts/run-docs-code-blocks.ts), 38-cold-agent-benchmark (dep 36, 22, 32, 10, all complete after batch 1; new file scripts/cold-agent-benchmark.ts), 40-registry-website (dep 28, 29, 36, complete after batch 1; new site, source_files TBD)

## Features

- [x] 39-registry-reservations (task), already complete from prior ad hoc work outside the wave build chain; phase field corrected idle -> all, no builder dispatched
- [ ] 35-comprehendo-md-generator (COMPONENT)
- [ ] 36-priming-snippet (COMPONENT)
- [ ] 37-docs-as-tests (COMPONENT)
- [ ] 38-cold-agent-benchmark (COMPONENT)
- [ ] 40-registry-website (COMPONENT)

## Judgment log

(populated as batches complete)
