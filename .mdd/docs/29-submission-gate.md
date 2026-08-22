---
id: 29-submission-gate
title: Submission Gate
type: COMPONENT
path: Registry / Submission Gate
source_files: [packages/registry-tools/src/gate.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: [25-cc11-registry-truth, 26-cc4-folklore-gate, 27-cc6-no-telemetry, 28-corpus-format, 21-fingerprint-index-matcher]
tags: [submission-gate, ci, folklore-rule, budget-gate, fingerprint-lint, docs-pointer-integrity, loop-lint, trust-ladder, codeowners]
test_files: []
known_issues: []
integration_contracts:
  - function: verifyAgainstUpstream
    when: "before a corpus PR is marked publishable"
    mandatory: true
---

# Submission Gate

## What to Build

The CI job that runs on every registry corpus PR against
`comprehendo-protocol/registry`: the folklore rule (CC4 [26]), budget
gates (CC5 [02]), fingerprint lint (collision detection, CC10 [20]),
schema-bound fix check (CC7 [09]), docs-pointer integrity (CC7 [09]), and
the loop lint (a topic whose operation has cataloged twins should show one
in its examples, so errors point at docs and docs point back at errors).
Runs identically on the Operator's native corpus and community
submissions, one discipline for both tiers. Must-not: never publish a
corpus that has not passed every one of these checks; never bot-merge a
first-time corpus for a high-adoption package.

## Architecture

`packages/registry-tools/src/gate.ts`. Consumes Corpus Format [28]
(`parse`/`validate`), CC11 Registry Truth [25] (the real-package
verification), CC4 Folklore Gate [26], CC6 No Telemetry [27] (network
scan extended to corpora), and Fingerprint Index & Matcher [21]
(collision lint). Feeds Scoped Publisher [31] (only a gate-passed corpus
may be packed and published) and Owner Endorsement [30] (endorsement
status is computed after this gate passes).

## Implementation Notes

- The submission channel is pull requests, never a web portal (the
  DefinitelyTyped shape): a PR supplies identity, review, per-fix
  history, and revert for free.
- CODEOWNERS per corpus directory: first author becomes owner and
  reviews their package's PRs. A merge bot lands owner-approved
  green-CI PRs so the core team is not the bottleneck.
- The trust ladder guards the human layer, on top of this gate's content
  checks: a first-time corpus for a high-adoption package requires core
  review, never bot-merge; CODEOWNERS changes always require core
  approval; diffs touching `fixes[].apply` get elevated review while
  docs-wording diffs may bot-merge; publishing happens only from CI on
  merged main with provenance attestations, no human publish tokens.
- `verifyAgainstUpstream` (declared here as a mandatory integration
  contract) is the CC11 [25] real-package verification step: install the
  actual target package, induce every cataloged fingerprint, assert twin
  and fix match reality. Any consumer that publishes a gate-passed corpus
  (Scoped Publisher [31]) must call this before treating a corpus as
  publishable.

## Data Model

Gate result: `{ prId, checks: { folklore, budget, fingerprintLint,
schemaBoundFix, docsPointerIntegrity, loopLint, registryTruth }, pass:
boolean, violations: string[] }`.

## API/Interface

N/A as a directly-called primitive; this is a CI job triggered on PR
events against the registry repo, not called by agents or providers.

## Business Rules

- Every check (folklore, budget, fingerprint lint, schema-bound fix,
  docs-pointer integrity, loop lint, registry truth, danger lint,
  injection lint) must pass before a corpus is merge-eligible.
- A first-time corpus for a high-adoption package requires core review;
  bot-merge never applies to it.
- CODEOWNERS changes always require core approval, regardless of CI
  status.
- Diffs touching `fixes[].apply` get elevated review; docs-wording-only
  diffs may bot-merge.
- Publishing happens only from CI on merged main with provenance
  attestations; no human ever holds a publish token.

## Acceptance Criteria

- [ ] A submission with an untestable fix is rejected, naming the
      folklore rule.
- [ ] A passing submission is marked publishable and its fingerprint
      index is built.
- [ ] The identical gate runs on the Operator's native corpus and a
      community submission with no special-cased path.
- [ ] A first-time high-adoption-package corpus cannot bot-merge, even
      with green CI.

## Dependencies

- [25-cc11-registry-truth](25-cc11-registry-truth.md)
- [26-cc4-folklore-gate](26-cc4-folklore-gate.md)
- [27-cc6-no-telemetry](27-cc6-no-telemetry.md)
- [28-corpus-format](28-corpus-format.md)
- [21-fingerprint-index-matcher](21-fingerprint-index-matcher.md)

## Known Issues

- [gap] The submission-gate policy for corpora targeting packages with
  hostile or rapidly-moving error surfaces is an open Wave-1 (well, here,
  Wave-5-relevant) design question; the upstream-watch lockfile pattern
  (Upstream Watch [34]) generalizes but its cadence is unproven outside a
  single driver.
