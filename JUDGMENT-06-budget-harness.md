# Judgment log, 06-budget-harness

Unattended /plan-execute run. Small, decide-and-log calls only; anything blocking
stops the build and is reported instead.

## Block plan (Phase 5)

Sequential, four blocks. Each has a runnable end state and its own verify command.

| # | Block | Files | Verify |
|---|---|---|---|
| 1 | Tokenizer and frozen budget table | `kit/budget/tokenizer.js`, `kit/budget/budgets.js` | `node --test kit/budget/tokenizer.test.js kit/budget/budgets.test.js` |
| 2 | Measurement and budget records | `kit/budget/measure.js` | `node --test kit/budget/measure.test.js` |
| 3 | Report and CI entry surface | `kit/budget/report.js`, `kit/budget/run.js` | `node --test kit/budget/harness.test.js` |
| 4 | Record the Wave-1 numbers | `kit/budget/README.md`, `.mdd/docs/06-budget-harness.md` | full suite + live CLI invocation |

Layer order: 1 (constants/primitives) -> 2 (service) -> 3 (entry wiring) -> 4 (docs).
No parallel agents; every block writes files the next one imports.

## Calls made

1. **Test tooling: `node --test` + `node:assert/strict`, ESM, plain JS.**
   `CLAUDE.md` names "Vitest per package, TypeScript strict" as the project stack;
   the repo root's only existing `package.json` is a name-reservation stub using
   `"test": "node --test"` and CommonJS. The orchestrator's instruction for this
   feature was explicitly "minimal JS test tooling, a lightweight assertion
   approach, match existing repo conventions". Resolved as: ESM (per CLAUDE.md's
   stated module format), `node --test` (per the root package.json's existing test
   script and the "minimal" instruction), plain `.js` with JSDoc-free small modules
   (this package is declared "data" in the spec's dependency graph; a TS build
   pipeline is a decision that belongs to `packages/core`, not here).
   Not blocking: no contract in `06`, `02`, or the source spec names a test runner.
   Wave 2 may migrate `packages/spec` to Vitest without touching the harness logic.

2. **Tokenizer dependency: `js-tiktoken@1.0.21` as a devDependency of
   `packages/spec`.** The doc forbids a word/char proxy and requires a
   "tiktoken-class" count, so a real BPE encoder is mandatory. `js-tiktoken` is
   pure JS, bundles its rank tables (no network at measure time), and has zero
   transitive dependencies. It is a **dev** dependency, so the spec package still
   ships zero runtime dependencies and the spec's "spec -> nothing" one-way
   dependency rule is untouched (that rule is about package-to-package imports).

3. **`measured` is the MAX across both declared encodings
   (`o200k_base`, `cl100k_base`), not one encoding.** The doc asks for the
   encoding "the model ecosystem this project targets" uses, which is not a single
   encoding. The two disagree by real amounts (`"ffmpeg"` is 1 token under
   cl100k_base and 2 under o200k_base), and 150 is a HARD cap, so measuring the
   larger makes "under 150 tokens" true in either accounting rather than true only
   under whichever encoder happened to be picked. The record names the encoding
   that produced the number, so a count is never ambiguous.

4. **The budget record carries `encoding` in addition to the four documented
   fields.** The doc's data model is `{scope, limit, measured, pass}`; those four
   are present, in that order, and a test pins them. `encoding` is appended so the
   record is self-describing, which is the point of call 3. Consistent with the
   spec's forward-compat rule (fields are only added within a major).

5. **Payload rendering: objects are measured as compact `JSON.stringify`, text is
   measured trimmed.** What an index or topic response costs an agent is the
   serialized payload it receives, so that is what gets tokenized; pretty-printing
   would bill whitespace the transport does not send. Trailing newlines on a
   snippet file are not part of the snippet.

6. **Tests use `await import(...)` inside each test rather than top-level
   imports.** With top-level imports, a missing module fails the whole FILE and the
   Red Gate can only observe "1 failure" per file instead of per test. This shape
   gave honest per-test red evidence (40 tests, 40 red) and costs nothing after
   green.

7. **CI workflow wiring deferred.** The harness exposes the CI contract it owes
   (a `comprehendo-budget` bin, `npm run budget`, exit 1 on any over-budget scope,
   `--json` records). Actually adding `.github/workflows/*.yml` would edit shared
   infrastructure this feature's `source_files` does not own, which the lane rules
   make the orchestrator's call, so it is recorded as `[deferred]` in the feature
   doc instead of written here.

8. **Baseline fixtures are authored in `kit/budget/fixtures/`, not taken from
   `03-shape-schemas` / `04-conformance-fixtures`.** Those siblings are concurrent
   or unbuilt, so their files cannot be depended on. The fixtures are inside this
   feature's own `source_files`, and the harness reads any artifact by path
   (`--scope <s> --file <p>`), which is the seam Waves 2, 5 and 7 use to point it
   at Docs Engine output, corpus topics, and the published priming snippet.

9. **The index baseline fixture is authored at the source spec's own declared
   reference scale (214 topics).** The RFC states the reference implementation
   ships "~200 one-topic files" and that `docs()` with no argument MUST return the
   full topic list. A budget set from a small toy index would be a one-way door
   that forbids the corpus size the spec itself prescribes.

10. **Budget headroom is bounded and tested, not free-hand.** Each limit is the
    measured baseline rounded up to a clean number, with a test asserting
    `baseline <= limit <= 2 * baseline` and a second test asserting the recorded
    baselines still match what the fixtures measure today. That keeps the numbers
    tied to evidence instead of drifting.

11. **The ratchet is a tested pure function, not a git-history walker.**
    `assertRatchet(previous, next)` rejects any increase, any dropped scope, any
    non-numeric limit, and any priming value above 150 regardless of direction. CI
    supplies `previous` by reading `budgets.js` from the base ref. Enforcing "the
    PR did not also edit the baseline" is a CI-configuration concern, so the honest
    split is: the rule lives here and is tested here, the base-ref fetch lives in
    the workflow (see call 7).
