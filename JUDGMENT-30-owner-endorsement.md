# JUDGMENT, 30 Owner Endorsement

Every decide-and-log call made building this feature, with the evidence.
Nothing here was escalated: none of it contradicted the doc, narrowed a
business rule, touched a file this feature does not own, or needed a
destructive operation.

## Call 1: the doc's `source_files` named `gate.ts`; this feature does not touch it

The doc's frontmatter listed `packages/registry-tools/src/gate.ts`, which
Submission Gate [29] also owns and which is already complete and merged.
Editing it would have meant a shared file across two waves' features for no
gain, and `feat/31-scoped-publisher` was building concurrently in a sibling
worktree.

29's own doc already says where endorsement belongs: "Feeds ... Owner
Endorsement [30] (endorsement status is computed AFTER this gate passes)". So
endorsement reads a finished `GateResult` and needs no hook inside
`runSubmissionGate`. `gate.ts` is untouched; `source_files` is rewritten to
the four files this build actually wrote. The doc's own `source_files` is a
field this feature owns, and Phase 7's rule for `test_files` (record reality,
not the Phase 3 prediction) is the same rule applied one field over.

## Call 2: the sha256 pin hashes the PACKED ARTIFACT, not the corpus source tree

The doc says the pin matches "the submitted corpus content", which does not
by itself say which bytes. Corpus Format [28] offers two candidates:
`serializeCorpus(pack(source))`, and the five-file authoring tree.

Chose the packed artifact, on three counts:

1. The pin names a corpus RELEASE. The release is the artifact: [28]'s
   `serializeCorpus` is documented as "the artifact as one deterministic
   string: equal corpora, equal bytes", and it is the exact bytes a
   consumer's runtime loads.
2. The authoring tree has no canonical byte form. Hashing it would mean
   inventing a directory-walk order and a line-ending rule here, which is a
   second undeclared format living inside a hash nobody could reproduce
   without reading this file.
3. The tree carries authoring-only state (`status: draft`) that never ships,
   so a pin over it would go stale on edits that change nothing a consumer
   sees, and an owner could not inspect what they were pinning without
   cloning the registry repo.

Recorded in `endorsement-digest.ts`'s header so the choice is legible where
it is made. Proved live: the digest over the built `dist/` output for a real
corpus is `04498622284f...d47c2`, and `packedDigest(packed) ===
sha256Hex(serializeCorpus(packed))` is a test.

## Call 3: `node:crypto` is real, and is checked against digests the world publishes

The task brief said `node:crypto` was "already used elsewhere in this
project's core package"; it is not (`grep -rn "node:crypto" packages` finds
nothing before this build). It is still the right answer: a Node builtin,
zero runtime dependencies preserved, no network reach, and NOT on CC6 [27]'s
forbidden list (`gate-telemetry.ts`'s `NETWORK_MODULES`), which is the list
this package is actually held to.

A hash function that only agrees with itself proves nothing, so the suite
pins the primitive to two digests anyone can check by hand:
`sha256Hex('') === e3b0c442...b855` and `sha256Hex('comprehendo') ===
de73b53a...524e`. Independently confirmed at the shell: `printf 'comprehendo'
| sha256sum` answers `de73b53adc7abef7a15d8f3f9f117f834c114829bf7b58f00dec5a4e42bc524e`.

## Call 4: the contract is satisfied TRANSITIVELY, and the guard is explicit, not incidental

29 declares `verifyAgainstUpstream` mandatory "before a corpus PR is marked
publishable". This component does not call it, and should not: 29's gate
already ran it, and re-running an install-and-induce cycle to re-learn an
answer already in hand would be a second source of truth.

What it does instead is refuse every rung above `community` unless
`gate.pass` is true AND `gate.checks.registryTruth === 'pass'`. The second
condition is redundant with the first in today's `runSubmissionGate` (`pass`
is every check passing, and an absent upstream makes `registryTruth` read
`not-run`), and it is written anyway, deliberately: a caller who hands this
function a hand-built or doctored ruling with `pass: true` must still buy
nothing. Both are tested, the second with a deliberately doctored result.

Teeth confirmed by mutation: replacing the `registryTruth` condition with
`false` turns 2 tests red (`refuses endorsement on a result claiming pass
while registryTruth never ran`, and the reason assertion in `refuses
endorsement when verifyAgainstUpstream never ran`). Restored immediately.

`satisfies_contracts` is therefore set to `done`, `verified_at:
packages/registry-tools/test/endorsement-gate.test.ts::refuses endorsement
when verifyAgainstUpstream never ran`, a real test in the running suite whose
gate result is a real `runSubmissionGate` run with the upstream verification
genuinely omitted.

## Call 5: `native` is READ off the live manifest, never awarded to a sidecar

The doc's Data Model spells three statuses, so leaving `native` unreachable
would have been narrowing a documented rule. It is reachable, and the honest
source for it is the same live manifest this whole tier rests on: when the
target's published manifest carries Manifest Wiring [15]'s `{version,
level}` declaration, the package speaks Comprehendo itself, declared through
the same publish credential.

What was deliberately NOT built: any path by which a sidecar corpus earns
`native` from its own content, approvals, or CI. The top rung is a fact about
the package, read; it is not something a corpus can be given. The corner this
leaves is recorded as a known issue (`prefer: sidecar` plus `require:
native`), not hidden.

## Call 6: every rung above community, including `native`, waits on the gate

An owner's native declaration is true whether or not the corpus passed CI, so
gating the `native` rung on the gate is stricter than strictly necessary. It
is still what shipped: the record is about a CORPUS RELEASE, and one rule
("nothing above community without a verified corpus") is far easier to reason
about and to enforce than a per-rung exception table. Fails closed, matching
`gate-policy.ts`'s stated posture. Tested (`refuses the native rung too when
the gate could not verify the corpus`).

## Call 7: identity comparison fails closed, and needs a scheme on both sides

`comprehendo.owners: ["github:name"]` carries a scheme, and the decision
requires one on the approver side too. A bare `octocat` names a login on some
provider, and which provider is exactly the question an identity check
exists to answer; reading it permissively would let `gitlab:octocat` stand in
for `github:octocat`. Both unscoped-owner and unscoped-approver cases are
tested and refuse by name. Case is folded, because the identity providers
this addresses fold it themselves.

`githubApprovers` is the one adapter across the registry-repo boundary: it
qualifies a bare login into the scheme the manifest spells, and does not
guess anything else. Where the approver list comes FROM (a GitHub reviews API
call) is out of scope here, on the far side of the same boundary 29 already
drew, and is recorded as a known issue rather than faked.

## Call 8: a pin that is not a sha256 is REPORTED, never interpreted

The conformance kit's forward-compat fixture
(`packages/spec/kit/fixtures/forward-compat.json`) shows the same manifest
key carrying `"corpus": "@comprehendo/mongodb-operator"`, a corpus PACKAGE
NAME. That fixture asserts only that the manifest schema ACCEPTS the
endorsement keys by the open-object rule; no schema constrains their values,
and doc 30 is explicit that the value is a sha256.

Rather than crash on it or read a name as a match (which would endorse
whatever that name resolves to today), `readPin` refuses anything that is not
64 hex characters and says so, and the endorsement lands at `community` with
that reason attached. A `sha256:` prefix is accepted and case is folded,
because a hex digest is the same digest either way; nothing else is.

## Call 9: no per-corpus findings filter, because it would be dead code today

The obvious extra precision, refusing endorsement when any of
`gate.findings` names this corpus directory, is unreachable in
`runSubmissionGate` as it stands: `pass` is true only when the findings list
is empty. Writing an unreachable branch and no test for it is exactly the
shape the folklore rule deletes, so it was not written. 29's own known issue
(check outcomes are PR-level, findings are per-corpus) is the honest place
this lives, and it is restated in this doc's known issues.

## Call 10: three of the 48 new tests were green at the Red Gate, by design

Recorded as controls, not as new coverage, the same way Config Loader [23]
recorded 12:

- `spells the three rungs exactly as Config Loader [23] spells them` asserts
  a frozen const against core's, which existed in the stub. It is a DRIFT
  guard and its job is to be green until somebody changes one of the two.
- `answers the honest UNSTRUCTURED rather than the corpus that was ruled out`
  and `still answers that same corpus for a consumer who demanded nothing`
  feed the literal `'community'` to core's already-shipped refusal. That
  behavior is 23's and has to be green before AND after this build; they are
  here so that a regression in the seam this feature fills is visible.

The other 45 were red at the Red Gate and are this build's coverage.
