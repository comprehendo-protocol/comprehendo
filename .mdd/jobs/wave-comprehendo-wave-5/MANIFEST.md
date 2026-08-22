# Wave job manifest: comprehendo-wave-5

mode: unattended
branch: wave/comprehendo-wave-5
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 4): 25-cc11-registry-truth, 26-cc4-folklore-gate, 27-cc6-no-telemetry (SPECs, no code, no deps), 28-corpus-format (dep 03, already complete; new file packages/registry-tools/src/corpus-format.ts, no overlap with the SPECs)
- batch 2 (sequential, 1): 29-submission-gate (dep 25, 26, 27, 28, 21; new file packages/registry-tools/src/gate.ts)
- batch 3 (parallel, 2): 30-owner-endorsement (dep 29; EXTENDS packages/registry-tools/src/gate.ts), 31-scoped-publisher (dep 28, 29; new file packages/registry-tools/src/publish.ts)

## Features

- [x] 25-cc11-registry-truth (SPEC), status/phase flipped; ACs pending 29-submission-gate's enforcement (same pattern as 19/20 in wave 4)
- [x] 26-cc4-folklore-gate (SPEC), status/phase flipped; ACs pending 29
- [x] 27-cc6-no-telemetry (SPEC), status/phase flipped; ACs pending 29 (AC1's network scan is independently checkable once 29 builds a real scan tool)
- [ ] 28-corpus-format (COMPONENT)
- [ ] 29-submission-gate (COMPONENT)
- [ ] 30-owner-endorsement (COMPONENT)
- [ ] 31-scoped-publisher (COMPONENT)

## Judgment log

(populated as batches complete)
