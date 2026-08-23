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
- [ ] 29-submission-gate (COMPONENT)
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
