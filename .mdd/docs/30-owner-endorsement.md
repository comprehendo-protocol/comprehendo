---
id: 30-owner-endorsement
title: Owner Endorsement
type: COMPONENT
path: Registry / Owner Endorsement
source_files: [packages/registry-tools/src/gate.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: [29-submission-gate]
tags: [owner-endorsement, trust-ladder, sha256-pin, owners-delegation, require-knob, graduation]
test_files: []
known_issues: []
satisfies_contracts:
  - from: 29-submission-gate
    function: verifyAgainstUpstream
    when: "before a corpus PR is marked publishable"
    status: pending
    verified_at: ""
---

# Owner Endorsement

## What to Build

The middle trust tier: a package owner who will not (yet) go native can
bless a community corpus through the one channel only the true owner
controls, their own package manifest. Two forms, owner's choice:
`comprehendo: { corpus: "<sha256>" }` pins exact corpus content
(strongest claim, release-coupled) and
`comprehendo: { owners: ["github:name"] }` delegates identity, so the
named people's approvals count as owner review with no republish per
update. The gate reads the manifest from the live registry copy of the
package on every corpus PR: matching content or an authorized approver
marks the corpus release ENDORSED. Must-not: endorsement is additive
trust, never a veto; a mismatch means the corpus is simply unendorsed,
the community tier keeps evolving.

## Architecture

Reads Submission Gate [29]'s pass result and the target package's live
manifest (fetched from its actual registry, the same registry CC11 [25]
installs from). Feeds Config Loader [23]'s `require` knob (a consumer can
demand `"require": { "<pkg>": "endorsed" }`).

## Implementation Notes

- The full trust ladder is community -> endorsed -> native. Nobody can
  claim to speak officially for a package they cannot publish to; that is
  the attack this tier deletes (only a real publish credential can set
  `comprehendo.corpus` or `comprehendo.owners` in the live manifest).
- `owners` delegation avoids a republish per corpus update: once an owner
  names approvers in their manifest, those approvers' PR approvals count
  as owner review going forward, no new package release required.
- Graduation is a PR replacing the corpus directory with a deprecation
  stub pointing at the now-native package, not a separate flow.
- Demand ranking for missing corpora comes from explicit registry issues
  with reactions, never from collected miss logs (no telemetry, CC6
  [27]).

## Data Model

Endorsement record: `{ package, corpusVersion, status: 'community' |
'endorsed' | 'native', endorsedBy?: 'sha256-match' | 'owner-approval',
manifestSnapshot }`.

## API/Interface

N/A as a directly-called primitive; endorsement status is computed by CI
and consumed by Config Loader [23]'s `require` knob evaluation.

## Business Rules

- `comprehendo.corpus` (sha256 pin) matching the submitted corpus content
  marks it ENDORSED.
- `comprehendo.owners` approval by a named delegate on the corpus PR
  marks it ENDORSED, no republish needed.
- A manifest mismatch never blocks the community corpus from publishing;
  it only withholds the ENDORSED status.
- `require: "endorsed"` (Config Loader [23]) rejects routing to a
  corpus that has not achieved ENDORSED status for that package.

## Acceptance Criteria

- [ ] A corpus PR matching the live manifest's `comprehendo.corpus` sha256
      is marked ENDORSED.
- [ ] A corpus PR approved by a manifest-named `owners` delegate is
      marked ENDORSED with no package republish.
- [ ] A manifest mismatch leaves the corpus published but unendorsed,
      never blocked.
- [ ] A consumer with `require: "endorsed"` set for a package is routed
      only to an ENDORSED (or native) corpus.

## Dependencies

- [29-submission-gate](29-submission-gate.md)

## Known Issues

None recorded at plan time.
