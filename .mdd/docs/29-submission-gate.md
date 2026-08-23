---
id: 29-submission-gate
title: Submission Gate
type: COMPONENT
path: Registry / Submission Gate
source_files: [packages/registry-tools/src/gate.ts, packages/registry-tools/src/gate-result.ts, packages/registry-tools/src/gate-upstream.ts, packages/registry-tools/src/gate-induce.ts, packages/registry-tools/src/gate-folklore.ts, packages/registry-tools/src/gate-lints.ts, packages/registry-tools/src/gate-telemetry.ts, packages/registry-tools/src/gate-fingerprint.ts, packages/registry-tools/src/gate-budget.ts, packages/registry-tools/src/gate-policy.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: [25-cc11-registry-truth, 26-cc4-folklore-gate, 27-cc6-no-telemetry, 28-corpus-format, 21-fingerprint-index-matcher]
tags: [submission-gate, ci, folklore-rule, budget-gate, fingerprint-lint, docs-pointer-integrity, loop-lint, trust-ladder, codeowners]
test_files: [packages/registry-tools/test/gate-corpus-checks.test.ts, packages/registry-tools/test/gate-folklore.test.ts, packages/registry-tools/test/gate-upstream.test.ts, packages/registry-tools/test/gate-lints.test.ts, packages/registry-tools/test/gate-telemetry.test.ts, packages/registry-tools/test/gate-policy.test.ts]
known_issues:
  - "[deferred] This repository is not `comprehendo-protocol/registry`, so the CI JOB the doc describes (the workflow file, CODEOWNERS per corpus directory, the merge bot) is not built here; what is built is the check logic that job imports and runs, plus `mergePolicy`, the trust ladder as a pure tested function. A workflow file committed into this repo would never fire, and infrastructure that cannot run is worse than a recorded boundary. See JUDGMENT call 1."
  - "[gap] The authoring corpus format has no slot for an inducing WITNESS (the call that provokes a cataloged failure). A fix's `apply` is the call that AVOIDS the failure and the inverse is not derivable, so witnesses arrive as a gate input rather than out of the corpus. The slot belongs in Corpus Format [28]'s `twins.json` (`induce`, literal call data, beside `fingerprint`), whose files are outside this feature's source_files. Nothing is weakened today: the gate trusts no witness, it runs them."
  - "[gap] The corpus format has no slot for a destructive-apply JUSTIFICATION either, so the danger lint accepts a fix's `docs` pointer as the justification, and only when the topic it resolves to actually names the destructive token. A dedicated `justification` field on a fix would be the honest home for it."
  - "[gap] `verifyAgainstUpstream` does not install: CC6 [27] forbids `child_process` and network code in this package, so the install is CI's own step and the gate receives `installRoot`. Proven against a REAL `npm pack` plus `npm install --offline` of a real toy target; generalising to an arbitrary registry package is a workflow line in the registry repo, unproven here because that repo does not exist yet."
  - "[gap] The danger lint's destructive vocabulary and the injection lint's phrase table are FLOORS, not proofs; neither can be complete. The injection table deliberately rejects second-person prose (\"you must\"), because CC11 [25] says corpus text is about the tool and never addressed to the agent, and ffmpeg Corpus [32] is the first feature that will feel that cost."
  - "[gap] The CC6 corpus scan refuses network-module references and URLs in EXECUTABLE content (worked-example code, `apply` payloads) and only the exfiltration builtins in prose, so a corpus documenting an HTTP client can still describe it. A worked example that legitimately streams from a URL is therefore not flagged unless it also calls a network builtin."
  - "[gap] Check outcomes are PR-level, not per-corpus: in a multi-corpus PR where one corpus could not be measured, `budget` reads `not-run` for the whole run. Every FINDING carries the corpus it belongs to, so only the summary is coarse."
  - "[gap] The submission-gate policy for corpora targeting packages with hostile or rapidly-moving error surfaces is an open design question; the upstream-watch lockfile pattern (Upstream Watch [34]) generalizes but its cadence is unproven outside a single driver."
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

Ten files in `packages/registry-tools/src/`, split at the size gate the
same way Corpus Format [28] and Fingerprint Index & Matcher [21] split
before it:

| Module | Job |
|---|---|
| `gate.ts` | the surface: `runSubmissionGate`, the input and result shapes, and the partition of 28's `validate` into check names |
| `gate-result.ts` | the shared vocabulary: what a submission is, what the checks are called, what a finding is |
| `gate-upstream.ts` | `verifyAgainstUpstream`: which installed package a directory names, and the run over it |
| `gate-induce.ts` | what it means to really provoke a failure and really prove a fix |
| `gate-folklore.ts` | CC4 [26]: the catalog diffed against observed coverage |
| `gate-lints.ts` | the loop lint, the danger lint and the injection lint |
| `gate-telemetry.ts` | CC6 [27]: the network scan, extended to corpus content |
| `gate-fingerprint.ts` | CC10 [20] / [21]: ONE index over every corpus, and its collisions |
| `gate-budget.ts` | CC5 [02]: the budget gate, with the spec kit's meter as a port |
| `gate-policy.ts` | the trust ladder: who may bot-merge, and who may not |

Consumes Corpus Format [28] (`parse`/`validate`/`pack`), Fingerprint
Index & Matcher [21] (`buildFingerprintIndex`), and
`packages/spec/kit/budget`'s real meter. Feeds Scoped Publisher [31]
(only a gate-passed corpus may be packed and published) and Owner
Endorsement [30] (endorsement status is computed after this gate passes).

The CI JOB itself (workflow, CODEOWNERS, merge bot) lives in
`comprehendo-protocol/registry` and is not in this repository; see Known
Issues.

## Implementation Notes

- The submission channel is pull requests, never a web portal (the
  DefinitelyTyped shape): a PR supplies identity, review, per-fix
  history, and revert for free.
- CODEOWNERS per corpus directory: first author becomes owner and
  reviews their package's PRs. A merge bot lands owner-approved
  green-CI PRs so the core team is not the bottleneck. `mergePolicy` is
  the rule set that bot obeys, and it is a pure function of the PR facts
  CI supplies, so the ladder is testable without the bot.
- The trust ladder guards the human layer, on top of this gate's content
  checks: a first-time corpus for a high-adoption package requires core
  review, never bot-merge; CODEOWNERS changes always require core
  approval; diffs touching `fixes[].apply` get elevated review while
  docs-wording diffs may bot-merge; publishing happens only from CI on
  merged main with provenance attestations, no human publish tokens.
- `verifyAgainstUpstream` (declared here as a mandatory integration
  contract) is the CC11 [25] real-package verification step: the target
  package is really installed (by CI, see Known Issues), every witnessed
  fingerprint is really induced out of it, the thrown error is routed
  through [21]'s real matcher, and every executable fix is really applied
  and retried. Any consumer that publishes a gate-passed corpus (Scoped
  Publisher [31]) must call this before treating a corpus as publishable,
  and cannot get a publishable result without it: a gate run with no
  upstream verification reports `registryTruth` and `folklore` as
  `not-run`, which is not `pass`.
- Nothing passes by default. Every check has three outcomes and the third
  is `not-run`; a gate that could not measure a corpus never reports it as
  fitting, and a gate that never ran the package never reports it as true.

## Data Model

Gate result: `{ prId, checks: { corpusFormat, schemaBoundFix,
docsPointerIntegrity, folklore, registryTruth, fingerprintLint, loopLint,
budget, dangerLint, injectionLint, telemetryScan }, pass, publishable,
violations: string[], findings, merge, index }`. Each check is `pass`,
`fail` or `not-run`; `pass` is every check passing; `violations` is every
finding rendered as one line for a PR comment.

Upstream verification: `{ directory, package, resolved?: {name, version},
inducedCodes: string[], verifiedFixes: string[], failures: [{kind, at,
detail}] }`, where `kind` is one of `no-such-package`,
`directory-mismatch`, `unloadable`, `unrunnable-witness`,
`not-inducible`, `misrouted`, `fix-did-not-resolve`.

Induction witness: `{ code, induce }`, where `induce` is literal call data
into the provider's declared surface (`{operation: [args]}`), supplied by
the PR and never trusted, only run.

Merge policy: `{ botMergeEligible, requiresCoreReview, elevatedReview,
reasons: string[] }`.

## API/Interface

Not an agent-callable primitive; this is the check logic a CI job on the
registry repo imports and runs, not a surface providers or agents call.

- `runSubmissionGate(input)`: every check, over every corpus in the PR, in
  one pass. Never throws; everything it found comes back as data.
- `verifyAgainstUpstream(options)`: the CC11 [25] verification against the
  really-installed package. Mandatory before publishable.
- `mergePolicy(facts, ciGreen, dangerousApply)`: the trust ladder.
- `fingerprintsOf(corpus)` / `buildIndex(corpora, published)`: the
  compiled entries, and the ONE index every corpus shares.
- `budgetFindings(packed, directory, meter)`: CC5, with the real meter
  passed in.

## Business Rules

- Every check (corpus format, folklore, budget, fingerprint lint,
  schema-bound fix, docs-pointer integrity, loop lint, registry truth,
  danger lint, injection lint, telemetry scan) must pass before a corpus
  is merge-eligible. A check that did not run has not passed.
- Coverage is what the gate OBSERVED, never what the corpus declared: an
  entry is provoked only if a real run really induced it out of the real
  package.
- A twin that was witnessed and no longer reproduces fails as DRIFT, which
  is a different finding from a twin nobody ever provoked.
- A corpus directory name must exact-match a package that really resolves
  in the install root AND really declares that name (no typosquats).
- A destructive `apply` requires a docs pointer to a topic that actually
  names it, and raises elevated review even when justified.
- Instruction-shaped content in a reason, a fix title, a topic summary or
  a worked example is rejected: corpus text is about the tool, never
  addressed to the agent.
- A corpus carrying stubs may be submitted (the gate is the author's
  feedback loop) and is never merge-eligible or publishable.
- A first-time corpus for a high-adoption package requires core review;
  bot-merge never applies to it, and an adoption level CI could not
  determine is treated as high.
- CODEOWNERS changes always require core approval, regardless of CI
  status.
- Diffs touching `fixes[].apply` get elevated review; docs-wording-only
  diffs may bot-merge.
- Publishing happens only from CI on merged main with provenance
  attestations; no human ever holds a publish token.

## Acceptance Criteria

- [x] A submission with an untestable fix is rejected, naming the
      folklore rule. Proven live through the built `dist/`: a real
      corpus on a real disk, a real npm-installed target, no witness,
      and the gate answers `folklore at toy-live/fixes[...]: the fix
      "Encode a non-empty payload" was never proved ... (folklore
      rule)`. Verified to have teeth: making `folkloreFindings` return
      nothing turns 5 tests red.
- [x] A passing submission is marked publishable and its fingerprint
      index is built. Same live run with the witness supplied: all 11
      checks `pass`, `publishable: true`, and `index` carries the
      compiled `LIVE_EMPTY` entry.
- [x] The identical gate runs on the Operator's native corpus and a
      community submission with no special-cased path. `GateInput` has
      no tier field to special-case on, and
      `gate-folklore.test.ts` runs the same defect in either tier and
      asserts the check outcomes and finding kinds are identical.
- [x] A first-time high-adoption-package corpus cannot bot-merge, even
      with green CI. `gate-policy.test.ts`, and the live run above
      (green CI, owner approved) answers `botMergeEligible: false,
      requiresCoreReview: true`.

## Dependencies

- [25-cc11-registry-truth](25-cc11-registry-truth.md)
- [26-cc4-folklore-gate](26-cc4-folklore-gate.md)
- [27-cc6-no-telemetry](27-cc6-no-telemetry.md)
- [28-corpus-format](28-corpus-format.md)
- [21-fingerprint-index-matcher](21-fingerprint-index-matcher.md)

## Known Issues

- [deferred] The CI job itself (workflow, CODEOWNERS, merge bot) belongs
  to `comprehendo-protocol/registry`, which is not this repository. This
  feature is the check logic that job runs, plus the trust ladder as a
  tested function.
- [gap] The corpus format has no slot for an inducing witness, so
  witnesses are a gate input. Named precisely in the frontmatter entry.
- [gap] The corpus format has no slot for a destructive-apply
  justification, so a docs pointer that names the operation stands in.
- [gap] `verifyAgainstUpstream` receives an install root rather than
  installing, because CC6 [27] forbids `child_process` here. Proven
  against a real `npm pack` plus `npm install --offline`.
- [gap] The danger and injection tables are floors, not proofs, and the
  injection table rejects second-person prose on purpose.
- [gap] The CC6 corpus scan is scoped to executable content plus the
  exfiltration builtins in prose.
- [gap] Check outcomes are PR-level; findings are per-corpus.
- [gap] The policy for corpora targeting hostile or rapidly-moving error
  surfaces is still open (Upstream Watch [34]).
