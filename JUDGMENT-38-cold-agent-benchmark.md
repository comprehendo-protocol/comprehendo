# JUDGMENT-38-cold-agent-benchmark

Unattended build, wave 7, branch `feat/38-cold-agent-benchmark`. Every
decide-and-log call taken during this build, with the evidence that settled
it. Blocking calls (there were none) would have stopped the run instead.

---

## Call 1: the central scope question, live agent session vs faithful-agent simulator

**The question.** The doc says "an agent given only the Priming Snippet
completes a scripted task suite". A literal reading needs a freshly-spun
model session whose entire system context is exactly the 144-token published
snippet and nothing else. Is that achievable in this build environment?

**What was actually checked, not assumed.**

1. `env | grep -iE 'anthropic|openai|api_key'`: no provider API key of any
   kind is present in this environment. `~/.env` holds Mongo, Docker, npm,
   RubyGems and GitHub tokens only, no model provider.
2. The `claude` CLI is on PATH and supports `--system-prompt`. It was
   MEASURED rather than assumed: a real `claude -p --system-prompt
   "<packages/spec/priming.md>"` run, in an empty temp directory outside the
   repo, asked the session to report its own context. Real output:

   ```
   {"tools": ["Agent","Bash","Edit","ListAgents","Read","ReportFindings",
              "ScheduleWakeup","Skill","ToolSearch","Workflow","Write"],
    "cwd_known": false,
    "system_prompt_char_count": 34000}
   ```

   So `--system-prompt` replaces the DEFAULT preamble, and roughly 34,000
   characters of harness context plus eleven tool definitions still ride
   along. That session's context is not "the priming snippet and nothing
   else" by three orders of magnitude, and the token cost this feature has
   to publish would be dominated by the harness rather than by the protocol.
   Ruled out on evidence, not on assumption.
3. `ollama` is installed and serving on 127.0.0.1:11434 with two local
   models pulled: `qwen3.5:latest` (9.7B) and `llama3:latest` (8B). The
   ollama `/api/chat` endpoint takes a `system` message verbatim, so the
   session's ENTIRE context is controllable byte for byte.

   - `qwen3.5` was probed with the snippet as system prompt: 207.7 seconds
     of real wall time to emit 120 tokens, all of them reasoning tokens,
     `content: ""`. Roughly 1.7 s/token and no answer inside a sane
     `num_predict`. Not viable to drive a multi-turn suite.
   - `llama3` was probed with the snippet as system prompt and one REAL
     benchmark turn (the `FFMPEG_FILTER_WITH_STREAMCOPY` stderr, an action
     menu, nothing else). 38.9 s including cold model load, and it answered
     correctly on the first try:
     `{"action":"comprehend","raw":"Filtering and streamcopy cannot be used together."}`

**The call.** A genuine live isolated model session IS available here, via
ollama, with a system prompt that is literally the bytes of
`packages/spec/priming.md` and nothing else. So both paths are built, and
they are published as two clearly separated numbers:

- **Tier A, the release gate: a deterministic faithful-agent simulator.**
  Mechanically follows the priming snippet's own instructions (probe the
  marker, `comprehend(raw)`, read `reason`, apply `fixes[0]`, follow the
  inert docs pointer, never read source unless docs answered UNDOCUMENTED)
  against the REAL scripted suite: real induced failures out of the real
  `ffmpeg` binary, real `createRouter` over a real installed corpus, real
  fix application and real retry. This is what gates the run, because it is
  deterministic, CI-runnable with no model at all, and it measures the
  PROTOCOL.
- **Tier B, live corroboration: a real isolated `llama3:8b` session**
  (`--live-agent`), system prompt byte-identical to `packages/spec/priming.md`
  (hash asserted at run time), the model choosing every action, the harness
  executing those actions against the same real router and real binary.
  Published with its own numbers, NOT gating.

**What Tier A proves and does not prove, stated precisely so the published
record cannot be read for more than it is.** Tier A proves the protocol is
correct and sufficient for a faithful reader of the snippet: every cataloged
failure routes to its own twin on the first `comprehend`, every executable
`fixes[0]` resolves its own failure on the first retry, every inert pointer
resolves to a real topic, the working case needs no protocol call at all,
and the one honest miss issues a real grant. It does NOT prove that an
arbitrary language model handed only that text behaves that way; that claim
needs a live session, which is exactly why Tier B exists and is published
separately. Tier B in turn proves one real 8B open-weights model's real
behavior on this suite, and nothing about frontier models.

**Precedent this follows.** 29/31's registry-repo boundary and 34's "never
run on a real GitHub runner" honesty: build the real thing that is reachable,
name the gap precisely, never let a harness stand in for the claim.

## Call 2: `node_modules` and the Python venv are copied from the main checkout, not installed

The worktree ships without `node_modules` (gitignored) and this build must
not depend on network. The three package lockfiles in the worktree are
byte-identical to the main checkout's (`diff -q`, all three IDENTICAL), so
`packages/{core,registry-tools,spec}/node_modules` and
`packages/python/.venv` (Python 3.13.7, pytest 9.1.1) were copied in with
`cp -a`. Both paths are gitignored, so nothing enters the branch. The
alternative, `npm install`, would have resolved the same lockfile over the
network for no difference.

## Call 3: two source files, not one, and the doc's `source_files` widened to match

The doc listed `scripts/cold-agent-benchmark.ts` alone. The build needs a
pure half (task suite, the agent policy, the argv applier, the rate
arithmetic, zero `node:` imports so "the policy cannot read a file" is a
property of the module rather than a promise) and an impure half (real
spawns, real router, real meter, the CC9 subprocesses, publishing, the CLI).
One file would have been roughly 540 lines, over this project's 400-line
ceiling, and the pure/impure seam is exactly what makes Business Rule 2
structurally assertable. Split as `scripts/cold-agent-suite.ts` (pure) and
`scripts/cold-agent-benchmark.ts` (impure), the same split 35 already
established with `comprehendo-md.ts` / `generate-comprehendo-md.ts`, and the
doc's `source_files` updated to both. The doc is this feature's own, so this
is a decide-and-log, not a blocker.

## Call 4: the CLI argv applier is duplicated, and the duplicate is guarded by a test

`applyToArgv` (Corpus Format [28]'s `apply` grammar for a command line) exists
only in `packages/registry-tools/test/helpers/ffmpeg-cli.ts`, a test helper.
Nothing in any `src/` ships it, and a `scripts/` file loads packages from
`dist/`, so it is not importable from the benchmark. Editing that helper to
export it from `src/` would mean touching a file this feature does not own.

Duplicated into `scripts/cold-agent-suite.ts` and then GUARDED: a test in
`packages/registry-tools/test/` (which can import the helper directly)
asserts the benchmark's applier produces the byte-identical argv as the
corpus's own helper for every fix in the real catalog on every task argv in
the suite. That is the project's stated answer to framework-imposed
duplication (`.claude/rules/react-router.md`: an unguarded copy is drift
waiting), applied here to a build-boundary-imposed one.

## Call 5: the suite is 14 tasks, and "first-corrected" is defined per task kind, in the open

The Operator baseline (18/18) is a RATE (100%) over structured error cycles,
not a task count, so the suite is not padded to 18. It is derived from the
corpus's own 12 cataloged failures plus two paths the failures cannot
exercise:

- 12 failure tasks, one per cataloged entry, each induced by the real
  witness argv against the real binary.
- 1 clean success path (transcode a synthetic clip, exit 0 first try). This
  exists to measure NON-guessing: a passing run requires the agent to make
  zero protocol calls and zero source reads on a working invocation.
- 1 honest-miss path: a real un-adopted package with no corpus installed,
  `docs(pkg, question)` answers UNDOCUMENTED with `source_permitted: true`,
  and the agent takes its ONE permitted source pass. This is the only branch
  in the whole run that reads a source file, and it makes the grant real
  rather than hypothetical.

First-corrected, per kind, published as a breakdown alongside the single
rate so the number is never ambiguous:

- executable-fix failure: the first `comprehend` names the right twin AND
  `fixes[0].apply`, applied to the same argv, exits 0 on the first retry.
- inert-pointer (runbook) failure: the first `comprehend` names the right
  twin AND `fixes[0]`'s docs pointer resolves to a real topic on the first
  `docs` call. A runbook has no `apply` to retry by design (32's own
  Implementation Notes), so it is counted as a resolved structured cycle and
  never as an executable retry. Wave 6's demo-state report already split the
  number this way.
- clean path: the invocation exits 0 with no correction and no protocol call.
- honest-miss path: `docs` answers UNDOCUMENTED and the single granted
  source pass answers the question.

## Call 6: CC9 re-runs both implementations, and a missing interpreter is a failure, never a skip

`10-cc9-marker-freeze` is a SPEC enforced in two places: `packages/core/test/
marker-freeze.test.ts` plus `marker-purity.test.ts` (JavaScript) and
`packages/python/tests/test_marker_freeze.py` plus `test_marker_purity.py`
(the Python port). The benchmark re-invokes BOTH as real subprocesses
(`vitest run <files>`, `<venv>/bin/python -m pytest <files>`), never a
reimplementation, so a real regression in either marker really turns this
gate red. `python3` on PATH here is 3.10 and the port needs 3.11+, so the
runner resolves an interpreter in order (`COMPREHENDO_PYTHON`, the package's
own `.venv`, `python3.13`, `python3`) and FAILS naming what is missing rather
than skipping, the same discipline `requireFfmpeg` already uses for CC4.

## Call 7: the marker-freeze mutation proof is done live and reverted, not planted permanently

A permanent test cannot mutate `packages/core/src/marker.ts`, which this
feature does not own. So the CC9 gate's teeth are proved two ways: a
permanent test drives the real subprocess runner against a real command that
really exits non-zero and asserts the gate reports failure and the benchmark
exits 1; and, once, live, the real marker literal was computed rather than
frozen and the full benchmark was re-run to watch it fail. The live output is
recorded in the feature doc's acceptance criteria and the mutation reverted
immediately.

## Call 8: `sessionTokenCost` is metered on the real budget tokenizer, and it is not a CC5 scope

CC5 defines three budget scopes (`index`, `topic`, `priming`); a session is
not one of them, so `measureScope` is the wrong entry point and inventing a
fourth scope would edit `packages/spec/kit/budget/budgets.js`, which this
feature does not own and which is a documented one-way ratchet. The cost is
therefore counted with the SAME meter one level down,
`packages/spec/kit/budget/tokenizer.js`'s `countTokens` (real js-tiktoken,
billed at the larger of `o200k_base` and `cl100k_base`, exactly as the
harness bills every other number in this project), over the exact text that
crossed into the session: the priming snippet once, every task goal, and
every observation payload as it would be rendered into context. Published on
every run, passing or failing, because the doc says so in as many words.
