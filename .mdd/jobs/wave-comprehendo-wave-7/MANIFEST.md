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
- [x] 37-docs-as-tests (COMPONENT), 26/26 new tests green, merged; extended 35's renderer with real, executed fenced code blocks (35 deliberately deferred this, previously zero blocks existed); closed a real, currently-open hole (worked examples were never actually run in CI, only paralleled by a hand-maintained argv table); post-merge review found and fixed a real write-target sandbox escape, see Fixed Issues
- [x] 38-cold-agent-benchmark (COMPONENT), 40/40 new tests green, merged; deterministic protocol-fidelity gate scores 14/14 (100%, matches the Operator baseline); live corroboration against a real llama3:8b model scores 1/14 (7.1%), published unchanged as a `[gap]`; CC9 re-run against both the JS and Python marker-freeze suites for real, live, on every run; found and fixed two real harness bugs via the live tier
- [x] 40-registry-website (COMPONENT), 61/61 new tests green (55 site + 6 contract), merged; satisfies_contracts on 29's verifyAgainstUpstream resolved to done (refuses every trust tier above community without a real verified upstream check); real registry-tools 404 handled honestly (UNAVAILABLE, not empty); real RFC served byte-identical; post-merge review found and fixed two real bypasses in the read-only audit's pattern table, see Fixed Issues

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

### 37-docs-as-tests (13 calls, unattended, no blockers)

1. **Path 1 (render real blocks into COMPREHENDO.md) over path 2 (a
   fixture), decided by trying it.** The doc's ACs were vacuous
   against 35's output (39 lines, zero fenced blocks). Verified the
   corpus's 15 worked examples (37 command lines) are real and run
   against the real binary BEFORE writing a line of the runner, and
   found the gap path 1 closes is real and currently open:
   `ffmpeg-witnesses.ts` runs a hand-maintained argv table that only
   PARALLELS the topic examples, nothing in CI ever ran the example
   text itself. Path 2 would have proven the runner and left that
   hole open. Cost accepted: COMPREHENDO.md grows 39 -> 167 lines,
   weighed against "index is a menu" (which governs `docs()` answers,
   untouched here, not the file-browsing channel) and recorded as a
   known_issue rather than hidden.
2. **"A block passes" defined without guessing at prose**: 8 of 15
   blocks are cataloged-failure demonstrations, so literal "executes
   successfully" is wrong for this corpus. Rejected inferring intent
   from `#` annotation lines (empirically two different things, quoted
   stderr and prose commentary, no mechanical separator, any heuristic
   fails a correct corpus). Adopted instead: the example's own TITLE
   names the disposition, the verdict for a non-zero exit comes from
   the corpus's REAL fingerprint index routing to the twin the title
   names. Real teeth: a renamed option, removed filter, or reworded
   error text stops matching and fails naming the block.
3. Each command in a block gets a FRESH workspace, not one shared
   per-block workspace: found by running them, 3 blocks broke when
   treated as a sequential script (the corpus deliberately omits `-y`,
   so a second command hits `File already exists`). Read as the
   faithful interpretation: each line is an independent illustration,
   not a step.
4. The declared workspace is a table this feature owns (same format
   gap `ffmpeg-witnesses.ts` already records), with two materialized
   roles read off the corpus, not guessed (`input`, `present-output`
   for the one file `FFMPEG_OUTPUT_EXISTS` needs already there) plus
   one declared-absent (`does-not-exist.mp4`). An undeclared `-i`
   operand FAILS the run naming the file and block, never a skip.
5. No shell, ever: tokenizes and spawns as an argv array, refuses
   shell metacharacters outside quotes naming the block, and an
   allowlisted program only (the corpus's own `declared_schema.
   surface` plus `ffprobe`, declared in code with its reason, never
   inferred from text). Same argument `ffmpeg-cli.ts` already makes.
6. An unsupported fence language FAILS, never skips: a gate that
   silently skips what it cannot run is the vacuous-green failure this
   whole feature exists to prevent.
7. The renderer emits `sh` as the fence info-string (the corpus's own
   topic files use bare fences); judged a RENDERING convention, same
   class as table-pipe escaping, not authored content, since it makes
   no claim about the package and is what gives the language field a
   real source instead of an assumption.
8. Three files, not one (587 lines over the cap): pure extraction/
   parsing (`docs-code-blocks.ts`), the declared workspace/allowlist/
   one real spawn (`docs-transcript-workspace.ts`), verdict/argv/exit
   code (`run-docs-code-blocks.ts`).
9. Exit codes follow the established contract (0/1/2/70), same
   vocabulary 17 and 35 use.
10. Files touched outside this feature's own `source_files`, all
    anticipated handoffs, no sibling lane overlap: `comprehendo-md.ts`
    and `corpora/ffmpeg/COMPREHENDO.md` (35's, explicitly invited;
    35's own suite re-run green after); `35-comprehendo-md-generator.md`
    (known_issues re-tagged, the deferral it recorded now resolved);
    new `.github/workflows/docs-as-tests.yml`.
11. Doc left at `active`/`verify`, not flipped to `complete`: Phase 7
    and bookkeeping reserved for the orchestrator.
12. The frontmatter-validate hook's "phantom files" report on this doc
    write was the known worktree-cwd artifact (resolves against
    `$CLAUDE_PROJECT_DIR`, the main checkout, where an unmerged
    branch's files legitimately don't exist yet), not a real doc
    defect; verified present in the worktree.
13. `packages/python`'s suite not runnable in this environment (needs
    3.11+, box has 3.10), zero Python touched, reported as not-
    runnable rather than folded into a green claim. registry-tools
    373/373, core 548/548, spec 436/436.

**Post-merge review finding, fixed 2026-08-23**: independent adversarial
review (isolated worktree) found `prepare()` validated read operands
against the declared workspace table but never validated the write
target, letting a corpus example write outside the sandboxed workspace
via an absolute path or `../` traversal, falsifying the doc's own
Security section claim. Fixed with `assertContainedWrite()`, mirroring
the read side's containment check. Both PoCs independently reproduced
pre-fix (succeeded) and post-fix (refused). Two new regression tests
added, mutation-verified (revert -> both go red; restore -> green).
registry-tools 375/375, core 548/548 after the fix. Full writeup in
`37-docs-as-tests.md`'s Fixed Issues section.

### 40-registry-website (13 calls, unattended, no blockers)

1. **satisfies_contracts investigated, not copy-pasted**: doc arrived
   with 29's `verifyAgainstUpstream` at `status: pending` (same
   templating artifact wave 5 hit on 30). Resolved to `done` because a
   website makes a PUBLIC TRUST CLAIM (a rendered badge), which is
   exactly what CC11/29's contract exists to gate: it refuses every
   trust tier above `community` unless the ruling it renders really
   carries `registryTruth`/`folklore` as `pass`. Reads CHECK OUTCOMES
   (31's own `UPSTREAM_CHECKS`, imported not copied) and 30's own
   `computeEndorsement`, no second opinion authored here. Tested
   against two REAL `runSubmissionGate` runs (real ffmpeg induction,
   real CC5 meter): one all-pass, one `registryTruth: not-run`.
   Mutation-verified, 3 tests red on deleting the refusal.
2. `comprehendo-protocol/registry` confirmed still not to exist (real
   404). Built a generic client and proved it live against repos that
   DO exist: the target repo (404 -> honest UNAVAILABLE, never an
   empty list), `comprehendo-protocol/comprehendo` (real 200, honestly
   empty), `nodejs/node` (real ranking over real reactions, PRs
   excluded). First case goes red the day the repo is created, the
   correct staleness signal.
3. `MDs/comprehendo-spec.md` confirmed still untracked (`git log --all
   -- MDs/` empty). Generator refuses with exit 2 naming the file
   rather than shipping spec-less; live proof ran against the real
   957-line RFC, `cmp` byte-identical. Committing the RFC is a
   repository-level decision outside this feature (83 em dashes vs.
   this project's own rule); recorded as a `[gap]`, not silently fixed.
4. New top-level `site/` (not `scripts/`): a deliverable artifact, not
   repo tooling, own `package.json`/`tsconfig.json`/`.gitignore`, zero
   shared files touched.
5. Two runners on purpose: `site/test/` under bare `node --test`
   (matches `packages/spec`); the contract suite under
   `packages/registry-tools` vitest because it needs 32's witness
   table/induction helpers, unreachable from `site/`'s node runtime.
   The one network module deliberately stays out of `packages/` so
   CC6's structural scan keeps covering exactly what it already covers.
6. Contrast checked by computation (not a rendered Playwright/axe
   gate): honest here specifically because the site imports zero
   third-party stylesheets, so every rendered colour really is in
   `render.ts`; recorded `[gap]`, becomes insufficient the day a vendor
   stylesheet is added.
7. A real flake found and fixed at the hook: the contract suite's
   `beforeAll` spawns real ffmpeg concurrently with 32/34's own suites
   under parallel load, occasionally exceeding vitest's 10s hook
   timeout (this package's config only lifted the TEST timeout).
   Fixed by lifting the hook timeout to 60s in the same file this
   feature already owned; confirmed stable across 3 consecutive runs.
8. `packages/python` not runnable in this environment (3.10 vs. 3.11+
   needed), zero Python touched. Baseline before this feature:
   registry-tools 347/347, core 548/548, spec 436/436.
9. Orchestrator independently re-verified post-merge: real CLI run of
   `site/build.ts` against the real RFC and real GitHub API (6 files
   written, real 404 handled honestly, 0 write surfaces, `spec.md`
   confirmed byte-identical via `diff`), full site suite (55/55) and
   contract suite (6/6) re-run green, typecheck clean. Adversarial
   review dispatched (isolated worktree) before PE3 close-out.

**Post-merge review finding, fixed 2026-08-23**: two real bypasses in
the read-only audit's pattern table, the sole gate `build.ts` trusts
before writing anything. `inline-handler` missed an unquoted attribute
value (`onclick=alert(1)`, no surrounding quote for the pattern to
anchor on); `remote-subresource` missed `srcset` (no word boundary
against `src`) and any CSS `url()` outside `@import` (an inline
`style="background:url(...)"`). Both independently reproduced pre-fix
(bypassed) and post-fix (caught); no page this generator emits today
uses either shape, so this closed a dormant hole, not an active leak.
Two regression tests added, mutation-verified (revert -> both red;
restore -> 57/57 green). Full writeup in `40-registry-website.md`'s
Fixed Issues section.

### 38-cold-agent-benchmark (13 calls, unattended, no blockers)

1. **The central scope question, checked not assumed**: does a
   literal "an agent given only the priming snippet" reading need a
   real live model session? Measured, not guessed: no provider API
   key exists in this environment (`claude` CLI's `--system-prompt`
   still carries roughly 34,000 chars of harness preamble plus 11
   tool defs, ruled out on real evidence); `ollama` is installed and
   serving with `llama3:8b` and `qwen3.5:9.7B` pulled, and the
   `/api/chat` endpoint takes a `system` message verbatim, so a
   session's ENTIRE context really is controllable byte for byte.
   `qwen3.5` timed out at roughly 1.7s/token; `llama3` answered a
   real probe turn correctly in 38.9s. Built both tiers: Tier A
   (gating) is a deterministic simulator that faithfully follows the
   published snippet's own instructions against the real scripted
   suite; Tier B (published, never gating) is a real isolated
   `llama3:8b` session, system-prompt sha256-pinned to
   `packages/spec/priming.md`.
2. Seven files, not one (the doc's one-file plan would have been
   roughly 1,700 lines): pure session types/policy/scoring
   (`cold-agent-suite.ts`), pure task data (`cold-agent-tasks.ts`),
   pure `apply` grammar (`cold-agent-apply.ts`), impure real
   consumer tree (`cold-agent-harness.ts`), impure CC9 re-run
   (`cold-agent-cc9.ts`), impure run/CLI (`cold-agent-benchmark.ts`),
   impure live tier (`cold-agent-live.ts`). Same pure/impure split
   precedent 35 set.
3. The CLI argv applier ([28]'s `apply` grammar) exists only in a
   test helper (`ffmpeg-cli.ts`); duplicated into
   `cold-agent-apply.ts` and GUARDED by a test asserting byte
   identical argv against the helper for every fix in the real
   catalog, the project's stated answer to a build-boundary-imposed
   duplication.
4. The 14-task suite: 12 cataloged failures (one per real induced
   twin) plus a clean success path (measures non-guessing: zero
   protocol calls on a working invocation) plus one honest-miss path
   (an un-adopted package, UNDOCUMENTED, the one permitted source
   pass). First-corrected defined per task kind (executable-fix,
   inert-pointer, clean, honest-miss), published as a breakdown
   alongside the single rate.
5. CC9 re-runs BOTH real implementations as real subprocesses
   (vitest for JS, pytest for Python via a resolved interpreter
   order that fails naming what's missing rather than skipping,
   same discipline as `requireFfmpeg`), never a reimplementation.
   Mutation-verified live: the real marker literal computed once,
   full benchmark re-run, watched fail, reverted immediately;
   permanently pinned by a test that drives the real subprocess
   runner.
6. An ungranted source read is counted and REFUSED, never performed:
   the refusal is a visible transcript observation, not a silent
   skip.
7. **The live tier found two real harness bugs the simulator
   structurally could not**: a granted source pass spent on a CLI
   target crashed on a nonexistent `node_modules/ffmpeg/index.js`
   (fixed: an honest sentence saying the target ships no importable
   source); an inert docs pointer applied as if executable threw
   (fixed: recorded as a real mistake, correctly not counted as
   first-corrected). Both now pinned by permanent tests.
8. **The live number came back bad and is published unchanged**:
   7.1% (1/14) against the 100% deterministic baseline, 6 ungranted
   source reads, recorded as a `[gap]` (not `[deferred]`, nobody has
   decided anything about it). Refused three ways to not fudge it:
   no re-prompting/coaching/retry-on-wrong-action; not quietly
   dropped (Business Rule 3 requires publishing "not only when it
   looks favorable"); not allowed to gate (measures one 8B model,
   not the protocol).
9. Orchestrator independently re-verified post-merge: full suite
   green on the merged wave branch (registry-tools 421/421, core
   548/548, spec 436/436), real CLI run of the deterministic gate
   (14/14, CC9 pass on both JS and Python), and, materially,
   **discovered the checkout's own `packages/python/.venv` (Python
   3.13.7) actually runs the Python suite for real (345/345)**,
   correcting every prior wave's "not runnable" finding, which used
   the system `python3` (3.10) rather than this checkout's own venv.
10. **Backward sweep, orchestrator's call**: `36-priming-snippet.md`'s
    AC2 and its known_issues entry were waiting on this feature,
    flagged by name in [38]'s own report as not its doc to edit.
    Re-tagged AC2 to `[x]` and the known_issues entry to `[gap]`,
    reflecting the two-number shape the proof actually landed in
    (100% deterministic, 7.1% live) rather than the single pass/fail
    the original wording anticipated.
11. Adversarial review dispatched (isolated worktree) before PE3
    close-out.
