---
id: 31-scoped-publisher
title: Scoped Publisher
type: COMPONENT
path: Registry / Scoped Publisher
source_files: [packages/registry-tools/src/publish.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: [28-corpus-format, 29-submission-gate]
tags: [publisher, scoped-package, ci-only-publish, provenance-attestation, no-human-tokens]
test_files: []
known_issues: []
satisfies_contracts:
  - from: 29-submission-gate
    function: verifyAgainstUpstream
    when: "before a corpus PR is marked publishable"
    status: pending
    verified_at: ""
---

# Scoped Publisher

## What to Build

Publishes a gate-passed, packed corpus as `@comprehendo/<pkg>` on merge to
main. Must-not: never publish a corpus that has not passed Submission
Gate [29] in full, including the CC11 [25] `verifyAgainstUpstream` check;
never publish from anywhere but CI on merged main; no human publish
tokens exist for this path at all.

## Architecture

`packages/registry-tools/src/publish.ts`. Consumes Corpus Format [28]'s
`pack()` output and only runs after Submission Gate [29] reports pass,
including its mandatory `verifyAgainstUpstream` check. Triggered by
merge to main on `comprehendo-protocol/registry`, never manually.

## Implementation Notes

- Publishing happens only from CI on merged main with provenance
  attestations (the trust-ladder rule from Submission Gate [29]): this
  component is the one place that actually executes a publish, and it is
  deliberately unreachable from a human's local machine or a hand-run
  script.
- Merge triggers the scoped publish automatically: no separate "please
  publish now" step exists in the happy path.

## Data Model

Publish record: `{ package: "@comprehendo/<pkg>", version, packedArtifactHash,
gateResult, provenanceAttestation }`.

## API/Interface

N/A as a directly-called primitive; triggered by CI on merge, not invoked
by agents, providers, or corpus authors directly.

## Business Rules

- A corpus is packed and published only after Submission Gate [29]
  reports a full pass, including `verifyAgainstUpstream`.
- Publishing runs only from CI on merged main; there is no human-invokable
  publish path.
- Every publish carries a provenance attestation tying the published
  artifact back to the exact merged commit and gate run.

## Acceptance Criteria

- [ ] A gate-passed corpus PR publishes as `@comprehendo/<pkg>`
      automatically on merge, with no manual trigger.
- [ ] A corpus that has not passed the gate (including
      `verifyAgainstUpstream`) cannot be published, verified by attempting
      it in a test harness.
- [ ] The published artifact carries a provenance attestation linking it
      to the merged commit.

## Dependencies

- [28-corpus-format](28-corpus-format.md)
- [29-submission-gate](29-submission-gate.md)

## Known Issues

None recorded at plan time.
