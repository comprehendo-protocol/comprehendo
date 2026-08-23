# Wave job manifest: comprehendo-wave-7

mode: unattended
branch: wave/comprehendo-wave-7
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 2): 35-comprehendo-md-generator (dep 13, 28, both complete; new file scripts/generate-comprehendo-md.ts), 36-priming-snippet (dep 02, 13, both complete; new file packages/spec/priming.md)
- batch 2 (parallel, 3): 37-docs-as-tests (dep 35; new file scripts/run-docs-code-blocks.ts), 38-cold-agent-benchmark (dep 36, 22, 32, 10, all complete after batch 1; new file scripts/cold-agent-benchmark.ts), 40-registry-website (dep 28, 29, 36, complete after batch 1; new site, source_files TBD)

## Features

- [x] 39-registry-reservations (task), already complete from prior ad hoc work outside the wave build chain; phase field corrected idle -> all, no builder dispatched
- [x] 35-comprehendo-md-generator (COMPONENT), 19/19 new tests green, merged; found and fixed a real bug (exit 70 instead of 2 on an unpackable corpus), mutation-verified 10 ways against the real ffmpeg corpus
- [x] 36-priming-snippet (COMPONENT), 18/18 new tests green, merged; 144/150 tokens on the real meter, iterated across 10 measured phrasings, both content and budget mutation-verified
- [ ] 37-docs-as-tests (COMPONENT)
- [ ] 38-cold-agent-benchmark (COMPONENT)
- [ ] 40-registry-website (COMPONENT)

## Judgment log

### 36-priming-snippet (12 calls, unattended, no blockers)

1. Started from the RFC's own "Reference form" (comprehendo-spec.md
   §5.5) verbatim, adapted only where forced: CLAUDE.md's own
   RFC-wins tiebreak, and the repo's own Wave-1 budget baseline
   fixture is already derived from this same text.
2. The RFC's em dash dropped for a colon (typographic style, not a
   normative claim, so "RFC wins" doesn't apply); the gate asserts
   its absence by codepoint so the published text can never regain
   one.
3. `validate` kept in (folded into the structured-errors sentence)
   despite the doc's "Nothing else" line, since that line targets
   marketing prose specifically and validate-before-execute is
   operational instruction an agent cannot use if never told it
   exists. Budgeted: with it, 144 tokens; without, 136; it fit, so it
   stayed.
4. Both tiers named (native probe AND the sidecar `comprehend(raw)`/
   `docs(pkg, question)` pair), since the RFC's reference form only
   teaches the native path but 38 drives ffmpeg, a package that never
   adopted Comprehendo, through the sidecar surface. An agent primed
   only on native and handed a bare stderr string would be told
   nothing it can act on.
5. The published file is the snippet and NOTHING else (no heading, no
   front matter, one paragraph, one trailing newline), asserted in
   the gate: the meter charges the whole file, so wrapper prose would
   count against the 150-token cap while never being pasted into an
   agents file, a lie in the safe direction that steals budget from
   the instructions.
6. The completeness-contract sentence is the one that got squeezed:
   spelled out per the RFC's identity skeleton, four phrasings
   measured 150-153 (over cap) with everything else the doc requires;
   the compressed form (144 total) keeps both load-bearing claims
   (source is not a fallback; UNDOCUMENTED grants one exception)
   intact, only the wording denser.
7. Two out-of-lane files (`packages/core/src/index.ts`'s barrel still
   only re-exporting `./sdk.js`; `packages/spec/package.json`'s
   `files` not listing `priming.md`) deliberately NOT edited, both
   outside `source_files`, recorded as `[gap]`s naming exactly what
   would change and who owns it.
8. The budget gate lives in `packages/spec/test/` with plain relative
   imports to the kit's real meter, no port, no dynamic import: unlike
   registry-tools' `gate-budget.ts`, there's no cross-package boundary
   here at all (artifact and meter both live inside `@comprehendo/spec`).
   `packages/spec`'s `node --test` already discovers it recursively
   (confirmed: 418 -> 436 tests).
9. Real assertions as the Red Gate skeletons (not a placeholder
   failure): 18/18 red for the real reason (`ENOENT ...
   priming.md`) before the snippet existed.
10. Mutation-verified three ways: in-suite padded-text measures over
    cap; in-suite padded copy through the real harness CLI exits 1
    with the exact budget-gate-failed message; live, outside the
    suite, the real snippet plus one padding line really fails
    (`FAIL priming 157 / 150 OVER BUDGET by 7`, exit 1). Content
    assertions separately mutation-verified: deleting the sidecar
    sentence and the UNDOCUMENTED clause from the real file turns
    exactly 3 of 18 tests red, naming the deleted instructions.
11. 144/150 (6 tokens headroom) accepted as sufficient, unlike
    `negative-budget.test.mjs`'s insistence on a decisively-over-budget
    must-FAIL fixture: the asymmetry is real, this text is frozen and
    measured deterministically under both declared encodings
    (o200k_base 144, cl100k_base 144, harness bills the larger), while
    a negative fixture stands in for arbitrary future corpus content.
12. `packages/python`'s suite cannot run in this environment (needs
    3.11+, this box's default is 3.10), pre-existing, zero Python
    files touched. Spec 436/436, core 548/548, registry-tools 328/328
    all green.

### 35-comprehendo-md-generator (11 calls, unattended, no blockers)

1. Generated file lands as `corpora/ffmpeg/COMPREHENDO.md`, a NEW file
   inside 32-ffmpeg-corpus's directory: the discovery channel requires
   a package-root file, this is the only real corpus package in the
   repo, and no sibling this wave touches `corpora/`, so no
   serialization risk. Nothing existing in that directory modified.
2. Split at the size gate (one file came to 429 lines, over the
   ceiling): `comprehendo-md.ts` pure (skeletons, renderer, drift
   report), `generate-comprehendo-md.ts` impure (module loading,
   files, argv, exit code), same split precedent as
   `corpus-format.ts`/`corpus-source.ts`.
3. **"Every word DERIVED" read precisely, held mechanically not by
   assertion**: every claim ABOUT THE PACKAGE comes from the corpus,
   the only other text is protocol skeleton quoted from the RFC
   (identical for every corpus). A test renders a copy of the real
   corpus with a different identity and asserts no word of the ffmpeg
   one survives; 9 renderer mutations each caught by a named test.
4. The RFC 5.5 identity sentence ("what the tool is and does") has no
   corpus slot to derive from (it's an SDK-entry field, not corpus
   data); states what the corpus documents instead of inventing a
   tool description, which would be exactly the hand-authored prose
   the Business Rule forbids. Recorded as a `[gap]` pointing at
   Corpus Format [28].
5. Imports the BUILT `dist/` modules of core/registry-tools, not
   `src/` (node's type stripping doesn't remap `.js` specifiers onto
   `.ts`, verified empirically); the resulting stale-`dist` risk is
   closed, not accepted: the suite compares `src`/`dist` mtimes and
   fails loudly naming the build command, verified by touching
   `docs.ts` and confirming the suite refuses to run.
6. CI gate follows 34's established shape (a vitest suite plus a
   workflow); the workflow loops over every `corpora/*/` carrying a
   `manifest.json` rather than naming ffmpeg by hand, so a future
   corpus with no generated file reports the real gap instead of
   silently passing.
7. New `scripts/package.json`/`tsconfig.json` (nothing in the repo
   covered `scripts/` before): `"type": "module"` so node reads
   `scripts/*.ts` as ESM, a real tsconfig so the scripts type-check at
   all.
8. **A corpus that no longer validates exits 2, not 70**: found while
   building, a deleted topic file made the CLI exit 70 (bug in this
   tool) because `CorpusFormatError` fell through the crash handler;
   fixed to exit 2 naming 28's own violations, matching 17's
   established exit-code contract. Matched by error NAME not
   `instanceof` (the script loads 28 from `dist/`, the suite from
   `src/`, two module instances share no class identity).
9. No fenced code blocks rendered (inline code spans only): emitting
   worked examples now would commit Docs As Tests [37] (depends on
   this feature, batch 2) to a runner shape before it exists, and the
   topic examples are ffmpeg command lines needing real media.
   Recorded as `[deferred]`, 37's call.
10. Doc edits scoped to this feature's own doc (source_files split,
    test_files, AC evidence, known issues); `status`/`phase` and the
    wave manifest left for the orchestrator.
11. `node_modules` hardlinked from the main checkout after verifying
    `package.json` byte-identity (fresh worktree had none); nothing
    tracked modified.
