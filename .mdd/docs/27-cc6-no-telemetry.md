---
id: 27-cc6-no-telemetry
title: CC6 No Telemetry
type: SPEC
path: Registry / Cross-Cutting Contracts / No Telemetry
source_files: []
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: []
tags: [no-telemetry, network-scan, sandbox-test, corpus-rejection]
test_files: [packages/core/test/no-telemetry.test.ts]
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

- This scan is a DIFFERENT shape from CC1 [07]'s, deliberately, found
  while building it: CC1's marker-purity scan is total I/O purity
  (`fs` included) over the marker module's own transitive closure
  alone, because the probe must do literally nothing. A package-wide
  scan cannot include `fs`: both `packages/core` and
  `packages/registry-tools` legitimately read files throughout (corpus
  discovery, config, manifests). This scan is narrower in subject
  (network-capable modules only, `net`/`tls`/`http`/`https`/`dns`/
  `child_process`/etc., never `fs`) and wider in reach (the whole
  package, not one module's closure).
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
      [partially met] `packages/core/src` and `packages/registry-tools/src`
      are both scanned for real (`packages/core/test/no-telemetry.test.ts`),
      reusing Submission Gate [29]'s own `NETWORK_MODULES`/
      `NETWORK_BUILTINS` tables via cross-package dynamic import, no
      second copy to drift. Mutation-verified live (a planted `node:net`
      import in a real source file turns the scan red; reverted,
      confirmed green). `packages/python`'s equivalent scan is not
      built; see Known Issues.
- [ ] The negative kit's telemetry-attempt fixture fails its gate.
      Not met, and the kit's own fixture already says so:
      `telemetry-attempt.json` carries `"enforced": false`. Traced why:
      the fixture's violation is a URL inside a docs TOPIC's worked
      example (`curl -X POST https://...`), and Submission Gate [29]'s
      real `gate-telemetry.ts` deliberately does not refuse a URL there
      (`refuseUrls: false` for worked examples, `true` only for
      `fixes[].apply`, per 29's own judgment call 11: a corpus
      documenting an HTTP client must be able to say "http"). Pre
      -existing at Wave 1, not introduced or silently left by this
      wave; see Known Issues.
- [ ] The full kit passes under a network-denying sandbox integration
      test. Not built: no such infrastructure exists in this project
      yet (no sandbox/container mechanism, no fetch/http monkey-patch
      harness). See Known Issues.

## Dependencies

None (foundational SPEC, lowest id in its wave).

## Known Issues

- [gap] `packages/python`'s equivalent package-wide network-import
  scan is not built. `packages/python/tests/helpers/source_scan.py`
  already has the AST-walking infrastructure (`imports_of`,
  `transitive_import_closure`) and an `IO_MODULES` set, but that set
  is CC1's I/O-purity scope (used only on the marker's own transitive
  closure), not a network-only list applied package-wide; curating
  the right Python network-module subset (`socket`, `http`, `urllib`,
  `ftplib`, `smtplib`, at minimum) and writing the package-wide test
  is real, separate work, not done here to avoid guessing at a list
  that could be wrong.
- [gap] The negative kit's `telemetry-attempt.json` fixture
  (`"enforced": false` since Wave 1) is not yet enforced by Submission
  Gate [29]: its violation is a URL inside a docs topic's worked
  example, and 29's real `gate-telemetry.ts` deliberately does not
  refuse URLs there (only in `fixes[].apply`), because a corpus
  documenting an HTTP client must still be able to say "http" and
  link upstream docs. Closing this needs either a narrower rule (a
  URL is fine, an active `curl`/POST-shaped worked example is not) or
  accepting the fixture describes an aspiration the format cannot yet
  distinguish from legitimate documentation. Neither decision was
  made here; it is exactly the kind of business-rule-narrowing call
  this project's unattended judgment protocol says to record and
  defer rather than guess on.
- [gap] The network-denying sandbox integration test (AC3) is not
  built: no sandbox/container mechanism or fetch/http monkey-patch
  harness exists in this project yet. A real implementation needs a
  deliberate choice of mechanism (OS-level network namespace, a
  Node-level global override, a CI-level firewall rule) that is
  infrastructure work, not a corpus or gate concern, and belongs to
  its own scoped feature rather than a wave-close patch.
