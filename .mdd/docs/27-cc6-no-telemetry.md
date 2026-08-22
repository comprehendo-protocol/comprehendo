---
id: 27-cc6-no-telemetry
title: CC6 No Telemetry
type: SPEC
path: Registry / Cross-Cutting Contracts / No Telemetry
source_files: []
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: []
tags: [no-telemetry, network-scan, sandbox-test, corpus-rejection]
test_files: []
known_issues: []
---

# CC6 No Telemetry

## What to Build

A contract, not code: the core packages contain no network code
(structural scan). Corpora containing network code are rejected at the
Submission Gate [29]. An integration test runs the full surface under a
network-denying sandbox and everything passes, because nothing ever
needed the network.

## Architecture

Enforced by a scan over `packages/core/`, `packages/python/`, and
`packages/registry-tools/` (no network imports anywhere), by Submission
Gate [29] extending the same scan to every corpus PR, and by a full
-surface integration test running under a network-denying sandbox
(no localhost exception, no allowed egress).

## Implementation Notes

- This scan is the same shape as CC1 [07]'s (marker modules scanned for
  `fs`/`net`/`http`/`dns`/`child_process`) but applied to the whole
  core surface, not just the marker.
- "Nothing ever needed the network" is a testable claim, not an
  assertion: the sandbox test is what proves it, by actually denying
  network access and running the full kit anyway.

## Data Model

N/A (a SPEC; the miss log and recorder, the two local-file mechanisms
this contract protects, are owned by Docs Engine [13] and Recorder [16]).

## API/Interface

N/A (a SPEC, no code exports).

## Business Rules

- Zero network imports anywhere in `packages/core/`, `packages/python/`,
  `packages/registry-tools/`.
- A corpus containing network code (in its docs prose, its fixes, or
  anywhere else executable) is rejected at the gate.
- The full conformance kit passes unchanged under a network-denying
  sandbox.

## Acceptance Criteria

- [ ] A network-import scan of every core package returns zero hits.
- [ ] The negative kit's telemetry-attempt fixture fails its gate.
- [ ] The full kit passes under a network-denying sandbox integration
      test.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

None recorded at plan time.
