# Wave job manifest: comprehendo-wave-7

mode: unattended
branch: wave/comprehendo-wave-7
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 2): 35-comprehendo-md-generator (dep 13, 28, both complete; new file scripts/generate-comprehendo-md.ts), 36-priming-snippet (dep 02, 13, both complete; new file packages/spec/priming.md)
- batch 2 (parallel, 3): 37-docs-as-tests (dep 35; new file scripts/run-docs-code-blocks.ts), 38-cold-agent-benchmark (dep 36, 22, 32, 10, all complete after batch 1; new file scripts/cold-agent-benchmark.ts), 40-registry-website (dep 28, 29, 36, complete after batch 1; new site, source_files TBD)

## Features

- [x] 39-registry-reservations (task), already complete from prior ad hoc work outside the wave build chain; phase field corrected idle -> all, no builder dispatched
- [ ] 35-comprehendo-md-generator (COMPONENT)
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
