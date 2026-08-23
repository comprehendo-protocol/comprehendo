---
id: 30-owner-endorsement
title: Owner Endorsement
type: COMPONENT
path: Registry / Owner Endorsement
source_files: [packages/registry-tools/src/endorsement.ts, packages/registry-tools/src/endorsement-manifest.ts, packages/registry-tools/src/endorsement-digest.ts, packages/registry-tools/src/endorsement-owners.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: [29-submission-gate]
tags: [owner-endorsement, trust-ladder, sha256-pin, owners-delegation, require-knob, graduation]
test_files: [packages/registry-tools/test/endorsement-gate.test.ts, packages/registry-tools/test/endorsement-sha256.test.ts, packages/registry-tools/test/endorsement-owners.test.ts, packages/registry-tools/test/endorsement-require-knob.test.ts]
known_issues:
  - "[deferred] The doc's source_files named gate.ts, which Submission Gate [29] owns and which this feature never touches: 29's own doc says endorsement is computed AFTER its gate passes, so this component reads a finished GateResult and needs no hook inside runSubmissionGate. source_files now records the four files this build actually wrote. See JUDGMENT call 1."
  - "[deferred] The sha256 pin hashes Corpus Format [28]'s PACKED ARTIFACT (serializeCorpus(pack(source))), not the five-file authoring tree. The artifact is what a corpus RELEASE is, it already has a canonical byte form (28: equal corpora, equal bytes), and hashing the tree would mean inventing a directory-walk and line-ending convention here. See JUDGMENT call 2."
  - "[deferred] 29's mandatory verifyAgainstUpstream contract is satisfied TRANSITIVELY: this component never calls it, it refuses every rung above community unless gate.pass is true AND gate.checks.registryTruth reads pass. The second condition is redundant with the first in today's runSubmissionGate and is written anyway, so a doctored ruling buys nothing. Both branches tested, teeth confirmed by mutation. JUDGMENT call 4."
  - "[deferred] The native rung is READ off the live manifest ([15]'s {version, level} declaration), never awarded to a sidecar corpus for its content or its approvals, and it waits on the gate like every other rung above community. JUDGMENT calls 5 and 6."
  - "[gap] The owners delegation is the DECISION only. Where the approver identities come from is a GitHub reviews API call belonging to the registry repo's CI job, on the far side of the boundary 29 already drew (this repository is not comprehendo-protocol/registry, and a workflow committed here would never fire). githubApprovers is the one adapter across it: it qualifies a bare login into the scheme the manifest spells and guesses nothing else."
  - "[gap] Identity matching requires a scheme on BOTH sides and fails closed without one, so an owner who writes \"octocat\" instead of \"github:octocat\" gets a named refusal rather than a match. That is deliberate (a bare login names a person on an unstated provider), and it is the one place an owner can misconfigure this tier into silence."
  - "[gap] Corpus Format [28] carries exactly one version field, the TARGET version the corpus was authored against, so that is what corpusVersion records. A distinct corpus RELEASE version does not exist in the format yet; when it does, this field should follow it rather than the target."
  - "[gap] A consumer setting both prefer: sidecar and require: native for a package whose live manifest declares native would be routed to the sidecar at trust native, because the record reports the PACKAGE's rung. The consumer explicitly asked for the sidecar, so nothing is silently substituted, but the two knobs together read oddly. Revisit if the native rung ever needs a corpus-side spelling."
  - "[gap] The gate ruling this reads is PR-level (29's own known issue: check outcomes are PR-level, findings are per-corpus), so in a multi-corpus PR every corpus stands or falls with the run. The obvious per-corpus findings filter is unreachable while pass implies an empty findings list, and an unreachable branch with no test is what the folklore rule deletes. JUDGMENT call 9."
  - "[deferred] 3 of the 48 new tests were green at the Red Gate by design and are recorded as controls, not new coverage: the trust-ladder drift assertion (a frozen const against core's, whose job is to stay green until one of the two moves) and the two that feed the literal 'community' to Config Loader [23]'s already-shipped refusal, which has to be green before AND after. The other 45 were red."
satisfies_contracts:
  - from: 29-submission-gate
    function: verifyAgainstUpstream
    when: "before a corpus PR is marked publishable"
    status: done
    verified_at: "packages/registry-tools/test/endorsement-gate.test.ts::refuses endorsement when verifyAgainstUpstream never ran"
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
manifest (read out of the install root CI already produced for [29], the
same really-installed copy CC11 [25] induces failures out of; this
component fetches nothing, because CC6 [27] forbids network code here).
Feeds Config Loader [23]'s `require` knob (a consumer can demand
`"require": { "<pkg>": "endorsed" }`).

Four files in `packages/registry-tools/src/`, split at the size gate the
same way [29] and Corpus Format [28] split before them:

| Module | Job |
|---|---|
| `endorsement.ts` | the ruling: `computeEndorsement`, the record, the ladder |
| `endorsement-manifest.ts` | the live manifest, read and projected to a snapshot |
| `endorsement-digest.ts` | real sha256, and what the pin is a hash OF |
| `endorsement-owners.ts` | the delegation decision, failing closed |

`gate.ts` is NOT touched: [29] says endorsement is computed after its gate
passes, so this component reads a finished `GateResult` rather than
hooking into `runSubmissionGate`. See Known Issues.

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
manifestSnapshot }`, plus `digest` (the sha256 really computed over the
submitted content, so a PR comment can show what was compared) and
`reasons` (why it landed where it did, one line each). It carries no
publishability field of any kind, which is business rule 3 expressed
structurally: there is no channel through which this ruling could refuse a
publish.

Manifest snapshot: `{ package, declaredName?, version?, corpus?, owners?,
native?: {version, level}, problems }`. Everything unreadable is named in
`problems`, never thrown and never guessed.

## API/Interface

Not an agent-callable primitive; endorsement status is computed by CI and
consumed by Config Loader [23]'s `require` knob evaluation.

- `readTargetManifest(installRoot, directory)`: the one door to a disk,
  the live manifest of the package CI really installed.
- `computeEndorsement(input)`: the ruling. Pure, and never throws.
- `corpusDigest(corpus)` / `packedDigest(packed)` / `readPin(declared)`:
  real sha256 over [28]'s serialized artifact, and the owner's declared
  pin, read or refused by name.
- `approvingDelegate({owners, approvers})` / `githubApprovers(logins)`:
  the delegation decision, and the one adapter across the registry-repo
  boundary.

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

- [x] A corpus PR matching the live manifest's `comprehendo.corpus` sha256
      is marked ENDORSED. Proven live through the built `dist/`: a real
      corpus on a real disk, a real `npm pack` plus `npm install
      --offline`, the owner's block travelling inside the tarball, and the
      answer is `status: "endorsed", endorsedBy: "sha256-match", digest:
      "04498622284f1f9896597362de4cdc1e5fa0532ac883c5fd4344a17db67d47c2"`.
- [x] A corpus PR approved by a manifest-named `owners` delegate is
      marked ENDORSED with no package republish. Same live run and
      `endorsement-gate.test.ts`; the no-republish half is asserted by
      running the same declaration against a second PR.
- [x] A manifest mismatch leaves the corpus published but unendorsed,
      never blocked. Live: `STALE PIN: community | gate still publishable:
      true`, and the record's key set carries no field a publisher could
      read as a refusal.
- [x] A consumer with `require: "endorsed"` set for a package is routed
      only to an ENDORSED (or native) corpus. Proven end to end through
      core's REAL router over a REAL error thrown by the really-installed
      package: endorsed answers `sidecar` / `LIVE_EMPTY`, the same corpus
      left at community answers `none` / `UNSTRUCTURED`.

## Dependencies

- [29-submission-gate](29-submission-gate.md)

## Known Issues

Recorded in the frontmatter; every entry is a decision with its why, or a
gap nobody has decided anything about yet. The two worth reading first:
what the sha256 pin is a hash OF (the packed artifact, not the authoring
tree), and how [29]'s mandatory `verifyAgainstUpstream` contract is
satisfied (transitively, by refusing every rung above community unless the
gate's own `registryTruth` check really passed).

The boundary this feature inherits rather than introduces: the approver
identities the delegation reads come from a GitHub API call belonging to
`comprehendo-protocol/registry`'s CI job, which is not this repository.
What is built here is the decision that call feeds, plus the one adapter
that qualifies a bare login into the scheme the manifest spells.
