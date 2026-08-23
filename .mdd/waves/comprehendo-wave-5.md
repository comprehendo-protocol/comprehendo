---
id: comprehendo-wave-5
title: Registry and the Submission Gate
initiative: comprehendo
initiative_version: 1
status: complete
depends_on: [comprehendo-wave-4]
demo_state: A corpus submission with an untestable fix is rejected by CI naming the folklore rule; a passing submission publishes as @comprehendo/<pkg> with its fingerprint index built; the gate's checks run identically on the Operator's native corpus, proving one discipline for both tiers.
content_hash: 2fceac869fac54bc
---

# Wave 5: Registry and the Submission Gate

Estimate: 3-4 days. The submission channel is pull requests against
`comprehendo-protocol/registry`, one directory per package, never a web
portal (the DefinitelyTyped shape): CODEOWNERS per corpus directory, a
merge bot lands owner-approved green-CI PRs, and publishing happens only
from CI on merged main with provenance attestations, no human publish
tokens. Owner endorsement is the middle trust tier, additive, never a veto.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 25 | CC11 Registry Truth | SPEC | (none) |
| 26 | CC4 Folklore Gate | SPEC | (none) |
| 27 | CC6 No Telemetry | SPEC | (none) |
| 28 | Corpus Format | COMPONENT | 03 |
| 29 | Submission Gate | COMPONENT | 25, 26, 27, 28, 21 |
| 30 | Owner Endorsement | COMPONENT | 29 |
| 31 | Scoped Publisher | COMPONENT | 28, 29 |

## Demo-state Result (unattended run, 2026-08-22)

Executed against the real runtime, not asked for confirmation
(unattended mode). Result: **MET IN FULL**.

- **A corpus submission with an untestable fix is rejected by CI naming
  the folklore rule: MET.** Submission Gate [29]'s `gate-folklore.test.ts`
  diffs the catalog against OBSERVED induced coverage (never a corpus
  -declared claim), naming the specific unprovoked entry; live-verified
  through the built `dist/` with the exact rejection message
  (`folklore at toy-live/fixes[...]: the fix "..." was never proved ...
  (folklore rule)`). Re-run live in this session: green.
- **A passing submission publishes as `@comprehendo/<pkg>` with its
  fingerprint index built: MET, and now genuinely round-trips.** Scoped
  Publisher [31] assembles the real payload (packed artifact, provenance
  attestation) only after a genuine `verifyAgainstUpstream` pass, live
  -verified through a real `npm pack --dry-run`. What was open at first
  build (core's `router-discovery.ts` could not yet read 31's own
  published format, measured live as a real 0-corpora gap) is closed:
  the orchestrator-level fix migrating `router-discovery.ts` to Corpus
  Format [28]'s authoritative artifact was reviewed independently with
  no blocking findings, and a real payload assembled with 28's/31's own
  functions is now discovered with zero defects and routes correctly.
- **The gate's checks run identically on the Operator's native corpus,
  proving one discipline for both tiers: MET.** CC4 Folklore Gate [26]'s
  own acceptance criterion, checked off by Submission Gate [29]'s build:
  no native/community special-casing anywhere in `gate*.ts`, the same
  `runSubmissionGate` call path for either. Re-run live in this session:
  green.

Wave-5 exit gate confirmed in this session: `packages/registry-tools`
242/242, `packages/core` 540/540, `packages/spec` 418/418 unaffected.
A new `packages/registry-tools` package's worth of registry
infrastructure (corpus format, submission gate, owner endorsement,
scoped publisher) shipped this wave, all built to the same real
-corpus, real-npm-install, non-mocked discipline established in prior
waves; zero mocks in any adversarial-path test across all six features.
One real cross-lane bug found and fixed by an independent builder
during this wave (17-corpus-generator's `declared_schema` drop,
mutation-verified), plus the router-discovery.ts producer/consumer
migration closed by the orchestrator directly and independently
reviewed. No real defects survived any of the five independent Phase 7
code reviews dispatched this wave (28, 29, 30, 31, and the
router-discovery.ts migration itself).
