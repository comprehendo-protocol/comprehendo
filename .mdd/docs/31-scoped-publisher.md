---
id: 31-scoped-publisher
title: Scoped Publisher
type: COMPONENT
path: Registry / Scoped Publisher
source_files: [packages/registry-tools/src/publish.ts, packages/registry-tools/src/publish-refusal.ts, packages/registry-tools/src/publish-provenance.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-5
depends_on: [28-corpus-format, 29-submission-gate]
tags: [publisher, scoped-package, ci-only-publish, provenance-attestation, no-human-tokens]
test_files: [packages/registry-tools/test/publish.test.ts]
known_issues:
  - "[deferred] This repository is not `comprehendo-protocol/registry`, so the thing that actually PUBLISHES (the merge workflow, the npm token, the `npm publish` call) is not built here, the same boundary Submission Gate [29] drew for its own CI job. What is built is the decision that workflow has to ask first and the payload it would publish, both pure and both tested. A workflow file committed into this repo would never fire. See JUDGMENT call 1."
  - "[deferred] Nothing here SIGNS anything. `provenanceAttestation` is a structured record (artifact sha256, merged commit, ref, repository, CI run, and the gate run's own checks), and it carries `signed: false` as a field rather than as a silence. A real SLSA provenance statement, a sigstore certificate or npm `--provenance` needs a CI OIDC identity and a real registry, neither of which exists here. When the registry repo gains one, the signed statement is built AROUND this record, not instead of it."
  - "[resolved by 22-router-precedence] `packages/core/src/router-discovery.ts` is migrated to Corpus Format [28]'s `comprehendo.corpus.json`. Fixed at the orchestrator level, mutation-verified, and re-verified live: a real payload assembled through this feature's own publish path is now discovered with zero defects. See 22-router-precedence.md Fixed Issues. JUDGMENT call 9 (this feature's own build) is what measured the gap live in the first place."
  - "[gap] `no human-invokable publish path` is enforced by the ARGUMENT LIST, not by a runtime check: `publishDecision` cannot be called without a `GateResult`, and the only way to obtain one is to have really run 29's gate over a really installed package. A library function cannot ask who called it, so the other half of the rule (only CI holds a publish token, no human token exists for this path) is credentials and workflow configuration in the registry repo."
  - "[gap] The binding between a gate result and the corpus it licenses is checked through the compiled fingerprint index, because that is the only corpus identity a `GateResult` carries. It catches a SWAPPED corpus (proven: a green run for toy-encoder does not publish toy-tagger) and it cannot catch a REPLAYED one (a corpus already on main is in that index too), and a corpus that compiles no fingerprints at all cannot be bound. The honest fix is a `corpora` field on `GateResult`, which is 29's file, outside this feature's `source_files`."
  - "[gap] `corpusPackageName` flattens a scoped target into the scoped corpus name (`@acme/widgets` becomes `@comprehendo/acme__widgets`), because `@comprehendo/@acme/widgets` is not a package name. The flattening is not injective: `@a/b__c` and `@a__b/c` both flatten to `@comprehendo/a__b__c`. Nothing mis-routes if it happens (the descriptor's `target` carries the real package name, and that is the field core reads first), but the two corpora would contend for one registry name and the second publish would be rejected by npm. A registry-side reservation check is the real answer and belongs to Registry Reservations [39]."
  - "[deferred] The scoped package's own version is supplied by CI (read off the corpus package's package.json), never derived from the corpus: a corpus's fixes need patch releases independent of the target package's version, and `PackedCorpus.version` is the TARGET's version, not the corpus's."
satisfies_contracts:
  - from: 29-submission-gate
    function: verifyAgainstUpstream
    when: "before a corpus PR is marked publishable"
    status: done
    verified_at: packages/registry-tools/test/publish.test.ts:98
---

# Scoped Publisher

## What to Build

Publishes a gate-passed, packed corpus as `@comprehendo/<pkg>` on merge to
main. Must-not: never publish a corpus that has not passed Submission
Gate [29] in full, including the CC11 [25] `verifyAgainstUpstream` check;
never publish from anywhere but CI on merged main; no human publish
tokens exist for this path at all.

## Architecture

Three files in `packages/registry-tools/src/`, split at the size gate the
same way Corpus Format [28] and Submission Gate [29] split before them:

| Module | Job |
|---|---|
| `publish.ts` | the surface: `publishDecision`, the request and record shapes, the scoped name, and the payload assembly |
| `publish-refusal.ts` | what stops a publish: the reason vocabulary and the three refusal checks (gate, corpus binding, trigger) |
| `publish-provenance.ts` | what produced these bytes: the artifact hash and the attestation record |

Consumes Corpus Format [28] (`pack`, `serializeCorpus`, `corpusDescriptor`,
`CORPUS_ARTIFACT`) and Submission Gate [29] (`GateResult`, and through it
`verifyAgainstUpstream`'s outcome). Consumed by the merge workflow in
`comprehendo-protocol/registry`, which is not this repository; that split,
and everything it means, is in Known Issues.

## Implementation Notes

### The publish is a refusal until four things hold

`publishDecision` returns a record only when all four hold, and returns
every reason it did not otherwise, as data (never a throw), the same way
28 returns violations and 29 returns findings:

1. The gate run really passed, INCLUDING `registryTruth` and `folklore`,
   the two checks 29 reports as `not-run` when `verifyAgainstUpstream` did
   not run. This is the mandatory integration contract, and it is enforced
   by reading those check outcomes rather than the `publishable` flag
   beside them: `publishable` is a boolean on a plain interface, and a
   corpus claiming to have been verified against a package nobody ran is
   exactly CC11 [25]'s threat model. Both halves are tested, with the real
   gate and with a deliberately forged result.
2. The gate run is about THIS corpus.
3. The trigger is the merge event, on `refs/heads/main`, at a real
   40-character commit sha. A sha that is not a sha refuses, because an
   attestation that cannot name its commit attests nothing.
4. The corpus still packs, through 28's REAL `pack`, which validates first.

### What the provenance attestation honestly is, and is not

It ties the exact artifact BYTES, by sha256 of what `serializeCorpus`
produced, to the exact merged commit and the exact gate run that permitted
them. Every field is something the process really computed or was really
told by the runner. It is not a signature, and it says so in a field. See
Known Issues.

### There is no human-invokable path, and that is an argument-list property

The only way to call this is with a `GateResult`, and the only way to
obtain one of those is to have really run the gate. A library function
cannot ask who called it, so the rest of the rule lives in the registry
repo's credentials. Recorded rather than implied.

## Data Model

Publish record: `{ package: "@comprehendo/<pkg>", version,
packedArtifactHash, gateResult, provenanceAttestation }`, plus the payload
the record is a record OF: `artifact` (the filename and the exact bytes),
`descriptor` (28's `corpusDescriptor`) and `manifest` (the package.json the
scoped package ships, carrying the descriptor under 28's own
`CORPUS_DESCRIPTOR_KEY`). The doc's five fields are all present under their
exact names; the three additions widen the model and narrow nothing.

Provenance attestation: `{ attestation: 1, package, version, target,
artifact, artifactHash, repository, ref, commit, mergedAt, runId?, gate:
{prId, checks, pass, publishable}, signed: false }`.

Refusal: `{ reason, detail }`, where `reason` is one of
`unverified-against-upstream`, `gate-not-publishable`,
`gate-result-not-for-this-corpus`, `not-a-merge-commit`,
`not-the-publish-branch`, `no-publish-version`, `unpackable-corpus`.

Trigger: `{ repository, event, ref, commit, mergedAt, runId? }`, what CI
states about the merge it is publishing from.

## API/Interface

N/A as a directly-called primitive; triggered by CI on merge, not invoked
by agents, providers, or corpus authors directly.

- `publishDecision(request)`: the whole decision, and the payload when it
  is permitted. Never throws.
- `corpusPackageName(target)`: the scoped package a target publishes under.
- `artifactHash(contents)` / `attestationOf(input)`: the digest and the
  record, exported because the registry workflow logs both.
- Constants: `PUBLISH_SCOPE`, `PUBLISH_REF`, `PUBLISH_EVENT`,
  `UPSTREAM_CHECKS`.

## Business Rules

- A corpus is packed and published only after Submission Gate [29]
  reports a full pass, including `verifyAgainstUpstream`. A check that did
  not run has not passed, and the summary flag is never trusted over the
  checks.
- A gate result licenses only the corpus it was run over.
- Publishing runs only from CI on merged main; there is no human-invokable
  publish path.
- Every publish carries a provenance attestation tying the published
  artifact back to the exact merged commit and gate run.
- The published artifact is 28's single packed artifact, byte for byte, and
  its hash is a real sha256 over those bytes.

## Acceptance Criteria

- [x] A gate-passed corpus PR publishes as `@comprehendo/<pkg>`
      automatically on merge, with no manual trigger. Proven live through
      the built `dist/`: a real corpus 17's real CLI wrote to a real disk,
      a real `npm pack` plus `npm install --offline` of the target, 29's
      real gate reporting all 11 checks `pass`, and the merge trigger
      producing `@comprehendo/toy-encoder@0.1.0`. The assembled payload was
      staged on disk and accepted by a real `npm pack --dry-run`
      (2 files: `comprehendo.corpus.json`, `package.json`).
- [x] A corpus that has not passed the gate (including
      `verifyAgainstUpstream`) cannot be published, verified by attempting
      it in a test harness. Two tests, one with the real gate run with no
      upstream verification supplied, one with a deliberately forged result
      claiming `publishable: true` while `registryTruth` reads `not-run`.
      Verified to have teeth: dropping the upstream-check refusal turns
      both red.
- [x] The published artifact carries a provenance attestation linking it
      to the merged commit. The attestation's `artifactHash` is the same
      digest the record publishes, and the live run's staged file hashes to
      exactly that value under the OS's own `sha256sum`.

## Dependencies

- [28-corpus-format](28-corpus-format.md)
- [29-submission-gate](29-submission-gate.md)

## Known Issues

- [deferred] The thing that actually publishes (workflow, token,
  `npm publish`) belongs to `comprehendo-protocol/registry`, which is not
  this repository. This feature is the decision and the payload.
- [deferred] Nothing here signs anything; `signed: false` is a field, not a
  silence. Real provenance signing needs a CI identity this repo lacks.
- [resolved by 22-router-precedence] Core's `router-discovery.ts` is
  migrated to read the payload this feature assembles. See
  [22-router-precedence](22-router-precedence.md) Fixed Issues.
- [gap] "No human-invokable publish path" is an argument-list property plus
  registry-repo credentials, not a runtime check.
- [gap] The gate-result-to-corpus binding rides on the compiled fingerprint
  index, which catches a swapped corpus and not a replayed one.
- [gap] The scoped-name flattening for scoped targets is not injective.
- [deferred] The scoped package's version comes from CI, not from the
  corpus.
