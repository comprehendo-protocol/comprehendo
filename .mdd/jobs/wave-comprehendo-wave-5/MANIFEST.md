# Wave job manifest: comprehendo-wave-5

mode: unattended
branch: wave/comprehendo-wave-5
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 4): 25-cc11-registry-truth, 26-cc4-folklore-gate, 27-cc6-no-telemetry (SPECs, no code, no deps), 28-corpus-format (dep 03, already complete; new file packages/registry-tools/src/corpus-format.ts, no overlap with the SPECs)
- batch 2 (sequential, 1): 29-submission-gate (dep 25, 26, 27, 28, 21; new file packages/registry-tools/src/gate.ts)
- batch 3 (parallel, 2): 30-owner-endorsement (dep 29; EXTENDS packages/registry-tools/src/gate.ts), 31-scoped-publisher (dep 28, 29; new file packages/registry-tools/src/publish.ts)

## Features

- [x] 25-cc11-registry-truth (SPEC), status/phase flipped; ACs pending 29-submission-gate's enforcement (same pattern as 19/20 in wave 4)
- [x] 26-cc4-folklore-gate (SPEC), status/phase flipped; ACs pending 29
- [x] 27-cc6-no-telemetry (SPEC), status/phase flipped; ACs pending 29 (AC1's network scan is independently checkable once 29 builds a real scan tool)
- [x] 28-corpus-format (COMPONENT), 65/65 new tests green, merged; found and fixed a real cross-lane bug in 17-corpus-generator (writeCorpus silently dropped a hand-added declared_schema on re-scan), mutation-verified
- [x] 29-submission-gate (COMPONENT), 67/67 new tests green, merged; checked off 25's and 26's ACs (their enforcement now real); checked off 20's third AC too (fingerprint lint now runs a real cross-package collision check)
- [x] 30-owner-endorsement (COMPONENT), 48/48 new tests green, merged; satisfies 29's mandatory verifyAgainstUpstream contract transitively, mutation-verified against a doctored gate result; resolved two of 23-config-loader's known_issues
- [x] 31-scoped-publisher (COMPONENT), 21/21 new tests green, merged; satisfies_contracts flipped to done; measured (not just predicted) the router-discovery.ts producer/consumer gap with a real live payload
- [ ] 30-owner-endorsement (COMPONENT)
- [ ] 31-scoped-publisher (COMPONENT)

## Judgment log

(SPECs 25-27 had no code phase, mechanical contract confirmation; ACs
pending 29's enforcement, same pattern as 19/20 in wave 4.)

### 28-corpus-format (16 calls, unattended, no blockers)

1. **One packed artifact, `comprehendo.corpus.json`, `corpus_packed: 1`**,
   not a ratification of 22's three provisional files: the feature doc is
   explicit ("a single versioned artifact"), and three files is three
   chances to ship half-updated (a fingerprint naming a twin code the
   catalog no longer carries MATCHES and answers UNSTRUCTURED, silently).
   Cost stated out loud: `router-discovery.ts` still reads the three old
   names, outside this lane's `source_files`; nothing regresses today
   (22's suites build their own corpora, 31 is the first real producer).
2. No compatibility emitter for the three old names: registry-tools takes
   no runtime import from core, so a shim could never be tested against
   the reader it exists for. "Every fix is provoked by a real test" rules
   out an untestable shim on the publish path.
3. JSON, not binary: zero runtime deps means hand-rolling a binary codec
   twice (TS and Python), and a PR reviewer must be able to read a
   published artifact (Submission Gate [29]'s whole channel model).
   `corpus_packed` is the actual answer to the open question: a binary
   encoding arrives as version 2, `readPackedCorpus` already refuses an
   unknown version by name.
4. `declared_schema` is a NEW slot in the authoring format (`manifest.json`
   had nowhere to put a provider's declared call schema, so every `apply`
   in every corpus was uncheckable, CC7 unenforceable at the registry
   tier). Optional; required only when a fix actually carries an `apply`.
   Surfaced a real bug in 17 (writeCorpus dropped it on rescan), fixed at
   the orchestrator level, see 17's Fixed Issues.
5. An `apply` with no declared schema is a violation (`undeclared-call
   -schema`), not a pass: same "null is not no-operations, it's
   uncheckable" reasoning core's own `applyOperations` already applies.
6. **`corpusEntryId` is the twin's published CODE, not 17's authoring id
   (load-bearing).** `router.ts:147` resolves a match with
   `builder.twinFor(match.entry.corpusEntryId, raw)`; binding the id
   instead doesn't throw, doesn't fail a type, just silently answers
   UNSTRUCTURED for a fully documented failure. Mutation-verified: 2 red.
7. `validate` returns data (never throws); `pack` runs `validate` itself
   and throws. Submission Gate [29] wants every finding in one PR
   comment; Scoped Publisher [31] must never publish unvalidated, and a
   calling-convention-only rule holds until one forgetful caller.
   Mutation-verified: 3 red.
8. The CC7/CC3 reason vocabulary is core's, reused verbatim and held by
   an AGREEMENT test (loads core's real `validateCatalog`, runs it over
   the same corpus, asserts identical reasons), not a literal-comparison
   test: a security fence deserves proof the two tiers reach the same
   verdict, not just matching strings.
9. Stubs are detected and refused at `pack` (structural: the packed
   format has no representation for an unwritten field); whether a PR
   carrying stubs may be SUBMITTED at all stays Submission Gate [29]'s
   policy call, not decided here.
10. CC3's raw-error-leak check is keyed on the throw site's message
    pattern (an authoring corpus has no `received`, but has the raw text
    a scan recorded); an author pasting it verbatim into `reason` is the
    exact leak CC3 exists to prevent. Mutation-verified: 1 red.
11. The front-matter reader is duplicated (one-way dependency, same as
    call 8), held by a two-parser AGREEMENT test over a topic file 17
    really wrote, not a literal comparison.
12. `stack_shape` and `kind` added to the authoring fingerprint (21
    defines three facets, the format only exposed two; 21's own Known
    Issues say the index format must not foreclose `static-pattern`).
    Both read-through only, never derived.
13. Six files, not one (`corpus-validate.ts` alone came in at 435 lines,
    over the 400-line gate), same split precedent as `twin.ts`/
    `twin-validate.ts` and `fingerprint.ts`/`fingerprint-facets.ts`.
14. Mutation testing (11 mutations, each reverted after measuring) found
    one real coverage gap: disabling the docs half's own version gate in
    `readPackedCorpus` left the suite fully green (two version numbers
    on the artifact, only one tested). Test added, now 1 red.
15. Every corpus under test is one 17-corpus-generator's REAL `runInit`/
    `runScan`/`writeCorpus` wrote to a real temp disk, loaded by dynamic
    import of core's real source, never a typed fixture: the AC is
    "parse reads what 17 produces", which a hand-typed fixture cannot
    prove.
16. Worktree had no installed deps; `node_modules` symlinked from the
    main checkout, nothing committed. Also confirmed and logged as
    pre-existing, not caused by this build: `packages/python`'s pytest
    suite fails collection in the main checkout too (no 3.11+
    interpreter environment installed here). Verified by the
    orchestrator: `python3 --version` is 3.10 on this machine, and the
    failure is `ImportError: cannot import name 'NotRequired' from
    'typing'` (added in 3.11), a pure environment gap, not a code bug.

### 29-submission-gate (20 calls, unattended, no blockers)

1. **This repo is not `comprehendo-protocol/registry`.** Built the
   reusable check logic (`gate*.ts`), no workflow file, no CODEOWNERS,
   no bot automation: a workflow committed here would never fire, and
   the trust ladder is implemented as `mergePolicy`, a pure tested
   function, so the registry repo's job is a thin caller.
2. `verifyAgainstUpstream` does not install (CC6 forbids
   `child_process`/network code in registry-tools); it takes
   `installRoot`, a real node_modules tree, and really loads and calls
   the package. The suite really runs `npm pack` + `npm install
   --offline` (fine in TEST code). Install is CI's one workflow line.
3. **The witness gap, named not faked.** Nothing in the authoring
   corpus format carries the call that PROVOKES a failure (`apply` is
   the call that avoids it; the inverse isn't derivable). Witnesses
   arrive as a gate input (`UpstreamOptions.witnesses`) and are
   trusted to nothing, they get RUN. The real fix (a corpus-format
   `induce` slot) is Corpus Format [28]'s file, outside this lane,
   recorded as a `[gap]`.
4. Folklore diffs OBSERVED coverage (what `verifyAgainstUpstream`
   itself witnessed), never a corpus field or author declaration: any
   input a submitter writes is an assertion, and 26 requires an
   actual test actually triggering the failure.
5. A docs-pointer fix (no `apply`) is provoked only when its twin was
   really induced and the pointer resolves; when the twin has no
   witness, the pointer fix is folklore too. Mutation-verified via
   `gate-folklore.test.ts`: losing the twin's witness turns the
   pointer fix red.
6. Drift (witnessed, no longer reproduces) and folklore (never
   witnessed) are different findings, never the same sentence:
   telling an author who broke nothing that they wrote folklore
   teaches people to ignore the gate.
7. **`not-run` is a third check outcome**, distinct from `pass`/`fail`,
   which is what makes `verifyAgainstUpstream`'s mandatory
   `integration_contracts` entry structural: skipping it can never
   read as green. Narrowing stated: outcomes are PR-level, not
   per-corpus (one unmeasurable corpus reads `not-run` for the whole
   run; findings still carry their own corpus).
8. Danger-lint justification is a fix's `docs` pointer, counted only
   when the topic it resolves to actually names the destructive
   operation; a justified destructive apply still raises
   `elevatedReview`, never a bot-merge free pass. Dedicated
   justification field recorded as a `[gap]` (format has no slot).
9. Destructive-operand and injection phrase tables are explicit FLOORS
   (stated in the file header): token-boundary matching (`purgeFrames`
   destructive, `transform` not; `-y` flagged as the operand that
   makes an ordinary call destructive).
10. Injection lint rejects second-person prose ("you must") on purpose:
    CC11's rule is "never addressed to the agent", and second-person
    imperative IS addressed to the agent. Cost recorded as a `[gap]`;
    ffmpeg Corpus [32] is the first feature that will feel it.
11. Telemetry scan refuses network-module references/URLs in
    EXECUTABLE content (examples, `apply` payloads) but only the
    exfiltration builtins in prose, so a corpus documenting an HTTP
    client can still say "http". Recorded as a `[gap]` (a legitimate
    URL-streaming example isn't flagged unless it also calls a
    network builtin).
12. `fingerprintsOf` duplicates `pack`'s mapping (gating the collision
    lint on a full `pack` would hide a real cross-corpus collision
    behind an unrelated typo), held by an agreement test against
    `pack(corpus).fingerprints`. Same load-bearing detail 28 flagged:
    `corpusEntryId` is the twin's published CODE, not 17's authoring id.
13. The CC5 budget meter is a caller-supplied port (registry-tools
    can't import `packages/spec/kit/budget`'s `js-tiktoken` dependency
    across the one-way boundary); tests wire in the REAL `measureScope`
    by dynamic import. `budget: not-run` when none is supplied, never
    approximated by a character-count proxy (wrong 3 to 5x on real
    content).
14. **28's open question, settled**: a stub-bearing corpus is
    submittable (feedback loop stays on for drafts), never
    merge-eligible or publishable (already structurally unrepresentable
    since `pack` refuses one; this adds the middle rung).
15. Result widens the doc's Data Model (adds `dangerLint`,
    `injectionLint`, `telemetryScan`, `corpusFormat`, `publishable`,
    `findings`, `index`), never narrows it; every doc-named check
    exists under its exact name.
16. Dynamic `import()` in `gate-upstream.ts` (to load the installed
    package under test) is not a CC6 violation: it's a local file-URL
    load in a build-time verifier, not network code, and is isolated
    behind a `ModuleLoader` port in its own file. Named explicitly
    since core's docs-engine scan forbids `import(` in a DIFFERENT
    context (a runtime engine), so the rule looks contradictory
    without the distinction spelled out.
17. `misrouted` (a witness that throws and matches a DIFFERENT
    cataloged entry) is reported distinctly from `not-inducible`:
    that's exactly 25's routing-hijack threat model, and folding it
    into "cannot be induced" would hide which entry a real failure
    actually belongs to.
18. Reported (not edited, outside this lane): 20-cc10-honest-miss's
    third AC is now satisfiable by `fingerprintFindings`'s real
    cross-package collision check. Checked off by the orchestrator,
    see 20's doc.
19. Ten files, not one (`gate.ts` named as the sole `source_files`
    entry would have meant a ~1,500-line file); doc's `source_files`
    updated to all ten. Every file under 250 lines, every function
    under 50.
20. Two toy fixture targets carry package-templated throw-site text so
    they don't share fingerprints by accident; collision suites create
    the collision on purpose, by rewriting one corpus's pattern to
    match the other's.

### 30-owner-endorsement (10 calls, unattended, no blockers)

1. `gate.ts` (doc's original `source_files`) is untouched: 29's own doc
   says endorsement is computed AFTER its gate passes, so this reads a
   finished `GateResult`, no hook inside `runSubmissionGate` needed.
   `source_files` rewritten to the 4 real files.
2. The sha256 pin hashes the PACKED ARTIFACT (`serializeCorpus(pack(source))`),
   not the 5-file authoring tree: the pin names a corpus RELEASE, the
   artifact is the exact bytes a consumer's runtime loads and already
   has a canonical byte form ("equal corpora, equal bytes"); the tree
   has no canonical byte form and carries authoring-only state
   (`status: draft`) that never ships.
3. `node:crypto` is a Node builtin, not on CC6's `NETWORK_MODULES`
   list, zero runtime deps preserved. Pinned to two independently
   checkable digests (`sha256Hex('') === e3b0c442...b855`,
   `sha256Hex('comprehendo')` confirmed against a real `sha256sum`).
4. **The mandatory contract is satisfied TRANSITIVELY, the guard is
   explicit not incidental.** Never calls `verifyAgainstUpstream`
   itself (re-running it would be a second source of truth over an
   answer 29 already has); refuses every rung above `community` unless
   `gate.pass` AND `gate.checks.registryTruth === 'pass'` both hold,
   the second condition deliberately redundant with the first so a
   doctored ruling still buys nothing. Mutation-verified: neutering
   the `registryTruth` condition turns 2 tests red.
5. `native` is READ off the live manifest (15's `{version, level}`
   declaration), never awarded to a sidecar corpus for its content or
   approvals: the top rung is a fact about the package, not something
   a corpus can be given.
6. Every rung above `community`, including `native`, waits on the
   gate: one rule ("nothing above community without a verified
   corpus") over a per-rung exception table, fails closed.
7. Identity comparison fails closed and needs a scheme on BOTH sides
   (`github:octocat`, not bare `octocat`): reading a bare login
   permissively would let `gitlab:octocat` stand in for
   `github:octocat`. `githubApprovers` is the one adapter across the
   registry-repo boundary, qualifying a login into the manifest's
   scheme and guessing nothing else; where approvals actually come
   from (a GitHub reviews API) is out of scope, recorded not faked.
8. A pin that is not 64 hex characters is REPORTED, never interpreted
   (the kit's forward-compat fixture shows the same manifest key
   sometimes carrying a corpus PACKAGE NAME instead); reading a name
   as a match would endorse whatever it resolves to today. Lands at
   `community` with the reason attached instead.
9. No per-corpus findings filter: unreachable in `runSubmissionGate`
   as it stands (`pass` is true only when findings is empty already),
   and an unreachable branch with no test is exactly what the
   folklore rule deletes. 29's own PR-level-vs-per-corpus known issue
   is the honest home for this, restated here.
10. 3 of 48 new tests were green at the Red Gate by design (a
    trust-ladder drift guard against core's frozen const, and two
    feeding the literal `'community'` to 23's already-shipped
    refusal), recorded as controls not coverage. The other 45 were red.

### 31-scoped-publisher (19 calls, unattended, no blockers)

1. Same repo boundary as 28/29: built the publish DECISION and
   ARTIFACT ASSEMBLY as pure tested functions, no workflow file, no
   `npm publish` call, no signing infrastructure.
2. **The publish path re-reads the gate's CHECKS, never trusts
   `publishable`.** `GateResult` is a plain interface, so a caller
   could hand in `publishable: true` with `registryTruth: not-run`,
   exactly CC11's threat model. `gateRefusals` checks
   `UPSTREAM_CHECKS` directly AND `publishable`. Mutation-verified:
   dropping the upstream check turns exactly 2 tests red.
3. `unverified-against-upstream` is its own refusal reason, distinct
   from `gate-not-publishable`, same reasoning 29 used for keeping
   `drift`/`folklore` distinct.
4. A refusal is data, never an exception, every reason returned at
   once (same pattern as 28's violations, 29's findings).
5. Provenance attestation is a RECORD with `signed: false` as an
   explicit field, not a silence: real signing (sigstore, npm
   `--provenance`) needs a CI OIDC identity and a real registry,
   named in known_issues rather than faked.
6. Trigger facts (`event`, `ref`, a 40-hex `commit`) are checked for
   SHAPE, not proven true (that needs CI identity, out of scope,
   named honestly); a commit that isn't a full sha refuses.
7. A gate result licenses only the corpus it was run over, checked
   through the compiled fingerprint index (the only corpus identity a
   `GateResult` carries): catches a SWAPPED corpus (tested: a green
   toy-encoder run does not publish toy-tagger), cannot catch a
   REPLAYED one, recorded as a `[gap]` (the real fix is a `corpora`
   field on `GateResult`, 29's file).
8. **The router-discovery.ts migration gap is MEASURED, not just
   predicted**: this feature's own real assembled payload, installed
   into a real consumer tree, found 0 corpora against core's real
   `discoverInstalledCorpora` (defect: declares comprehendoCorpus but
   carries none of the three OLD artifact names). Out of lane (owned
   by doc 22, outside `source_files`), flagged to the orchestrator
   with live evidence rather than left implied.
9. Scoped package version comes from CI (read off the corpus
   package's own package.json), never derived from the corpus: a
   corpus's fixes need patch releases independent of the target's
   version.
10. Scoped target flattening (`@acme/widgets` -> `@comprehendo/
    acme__widgets`) is not injective (`@a/b__c`/`@a__b/c` collide),
    recorded as a `[gap]`; nothing mis-routes today since the
    descriptor's `target` field carries the real name and core reads
    that first.
11. Three files, not one (405-line single file over the 400 gate),
    same split precedent as 28 (six files) and 29 (ten).
12. Every passing `GateResult` under test is a REAL one (17's real
    writers, real `npm pack`/`install --offline`, 29's real
    `verifyAgainstUpstream`); the one hand-typed forged result is the
    deliberate subject of the CC11 threat-model test, not a
    convenience double.
13. Mutation testing, 3 mutations: dropping the upstream-check
    refusal (2 red), neutering the corpus-binding check (1 red),
    replacing sha256 with a length placeholder (1 red, and exposed
    that the "two corpora hash differently" test is what's load
    -bearing, not a generic length check).
