# Judgment log, 36-priming-snippet

Every call made without asking, and why. Decide-and-log applies to the small
ambiguous ones; nothing here rose to a blocker. Two findings belong to OTHER
features and are recorded rather than acted on (calls 6 and 7).

---

## 1. The RFC's reference form is the starting text, adapted, not reinvented

**The question.** The feature doc says "written and then measured, iterated
until it is both complete and under budget" but gives no text. RFC section 5.5
gives a "Reference form (a provider adapts the names)".

**The call.** Start from the RFC's reference form verbatim, keep its order and
its phrasing wherever a change was not forced, and adapt only where the doc's
Business Rules or this project's own style demanded it.

**Why.** CLAUDE.md's tiebreak is explicit: where a doc and the RFC disagree the
RFC wins. The reference form is also already in this repo as the Wave-1 budget
baseline (`kit/budget/fixtures/priming.reference.md`, 127 tokens), so starting
anywhere else would have detached the published snippet from the number CC5's
own baseline was derived from.

## 2. The RFC's em dash is dropped, not preserved

**The question.** The RFC's reference form contains an em dash ("in any
vocabulary you know , its own terms"). CLAUDE.md bans em dashes in source and
docs, and a pre-write hook enforces it.

**The call.** Replace it with a colon (`in any vocabulary: its terms, another
tool's, or a task`), and assert the absence in the gate test so the published
text can never regain one.

**Why.** This is a typographic style rule, not a normative protocol claim, so
"the RFC wins" does not apply: no behaviour changes. The repo's own copy of the
reference form already made the same substitution in Wave 1, so the published
snippet and the baseline fixture stay consistent with each other. The test that
detects a long dash builds its pattern with `String.fromCharCode(0x2014,
0x2013)` because the file itself may not contain one.

## 3. `validate` stays in, even though the doc's Business Rules do not list it

**The question.** The doc says the snippet covers the marker probe,
`comprehend`/`docs`, the completeness contract and the UNDOCUMENTED source
pass, "Nothing else." The RFC's reference form also says "When `validate`
exists, validate before executing."

**The call.** Keep the validate clause, folded into the structured-errors
sentence ("read `reason`, apply `fixes[0]`, and validate before executing where
`validate` exists").

**Why.** The RFC's list is normative and the doc's "Nothing else" is aimed at
marketing prose, which is what the same sentence names as the must-not ("never
a marketing description, only the operational instructions an agent needs").
Validate-before-execute is operational instruction, it is a Level 2 surface an
agent cannot use if it is never told it exists, and it fits: measured with the
clause the snippet is 144 tokens, without it 136, and the cap is 150. Had it
not fit, this clause was the first thing budgeted out; it did fit.

## 4. Both tiers are named, because the benchmark drives the sidecar tier

**The question.** The RFC reference form teaches only the native path (probe,
then `.docs(question)` on the entry). The doc's Business Rules require
"`comprehend`/`docs`", and [38] drives ffmpeg, a package that never adopted
Comprehendo, through Router & Precedence [22]'s sidecar surface.

**The call.** Add one sentence for the un-adopted case: "No marker: call
`comprehend(raw)` or `docs(pkg, question)` from `comprehendo`."

**Why.** An agent primed only on the native path and then handed a bare ffmpeg
stderr string has been told nothing it can act on, which is exactly [38]'s
scenario and exactly the failure the snippet exists to prevent. It also matches
CLAUDE.md's own description of the package's agent surfaces
(`comprehend(raw)`, `docs(pkg, query?)`, the fingerprint router) and the real
`Router` interface in `packages/core/src/router.ts`.

## 5. The published file is the snippet and nothing else

**The question.** `priming.md` could carry a heading, a short preface, or front
matter explaining what it is.

**The call.** The file contains exactly the snippet, one paragraph, one
trailing newline. No heading, no front matter, no preface. Asserted in the gate
test.

**Why.** The budget meter charges for the whole file (`measureFile` measures a
non-`.json` artifact as its own trimmed text), so any wrapper prose would be
counted against the 150-token cap while never being pasted into an agents file,
which makes the published number a lie in the safe direction and steals budget
from the instructions. It also means [38] can read the file and use it as
context with no stripping step, no parser, and nothing to get wrong. The Wave-1
baseline fixture is shaped the same way.

## 6. The completeness contract is compressed, and this is the sentence that got squeezed

**The question.** The RFC's `identity` skeleton spells the contract "If it is
not documented here it does not exist; do not read the source , except where an
UNDOCUMENTED response permits it for a specific question." Spelled out that way
in the snippet, with everything else the doc requires, the text measured 151 to
153 tokens across four phrasings, over the cap.

**The call.** Publish "Undocumented means nonexistent: never read source, unless
docs answered `UNDOCUMENTED`, which permits one source pass for that question."
(144 tokens total). Six alternative phrasings were measured; the four clearer
long forms measured 150 to 153 and were rejected for being over or on the cap.

**Why.** The two claims that must survive are the prohibition (source is not a
fallback) and its single exception (an UNDOCUMENTED answer grants a pass, for
that question only). Both survive intact; only the wording is denser. The
iteration is recorded here rather than presented as a first draft that happened
to fit, because the doc explicitly says the snippet is "never assumed to fit".

## 7. Scope held at the doc's one file, twice

**The question.** Two adjacent things wanted editing and are outside
`source_files`: `packages/core/src/index.ts` (the barrel still re-exports only
`./sdk.js`, so the `comprehend`/`docs` pair the snippet names is not reachable
from the package barrel yet) and `packages/spec/package.json` (`files` lists
only `kit`, so `priming.md` is not in that package's tarball).

**The call.** Edit neither. Record both as `[gap]` entries on the feature doc,
naming precisely what would change and who owns it.

**Why.** The lane rules make a file the doc does not own a blocker, not a file
to edit, and neither gap weakens what this feature ships: the budget gate and
[38] both read `priming.md` from the repo, and `@comprehendo/spec` is
`private: true`, so nothing is published wrongly today. The barrel export is a
distribution decision `packages/core/package.json` itself defers to Wave 7's
packaging work, not a fix to smuggle in here.

## 8. The gate test lives in `packages/spec/test/`, importing the kit directly

**The question.** Where the CI-runnable budget gate for this artifact belongs,
and whether the meter needs the cross-package port dance that
`packages/registry-tools` needed for `gate-budget.ts`.

**The call.** `packages/spec/test/priming-budget.test.mjs`, importing
`../kit/budget/{budgets,measure,tokenizer}.js` with plain relative imports. No
port, no dynamic import, no new script.

**Why.** There is no cross-package boundary here at all: the artifact and the
meter are both inside `@comprehendo/spec`, so the reason registry-tools had to
port the harness (CC6's zero-runtime-dependency rule plus a one-way dependency
direction) simply does not apply. `packages/spec`'s `npm test` is `node --test`,
which already discovers `test/*.test.mjs` and `kit/budget/*.test.js`
recursively, so the file is in CI the moment it exists (confirmed: the spec
suite went from 418 to 436 tests). This also keeps the number honest: the gate
measures with the same module `measure.test.js` re-measures the CC5 baselines
with, so the published snippet and the recorded baselines can never drift onto
two different meters.

## 9. Real assertions as the Red Gate skeletons, not `fail('MDD skeleton')`

**The question.** Phase 4 wants skeletons that fail; the build skill's default
placeholder is an unconditional failure.

**The call.** Write the real assertions immediately. They were red for the real
reason (`ENOENT ... packages/spec/priming.md`, 18 of 18 failing) before the
snippet existed.

**Why.** A placeholder proves the file runs; these proved the file runs AND
that every assertion is wired to the artifact's absence, which is strictly more
than the gate asks for. Nothing was weakened: the gate ran, and all 18 were
confirmed red before any implementation.

## 10. The gate is mutation-verified three ways, not asserted once

**The question.** How to show the gate actually fails rather than merely
reporting a number.

**The call.** Three checks, all run: (a) in-suite, the published text padded
past the cap measures over and returns `pass: false`; (b) in-suite, a padded
copy pushed through the real harness CLI exits 1 with the exact
`budget gate failed: priming measured N tokens against a budget of 150`
message; (c) live, outside the suite, the published snippet with one padding
line appended really failed: `FAIL priming 157 / 150 OVER BUDGET by 7`,
exit 1. Separately, the CONTENT assertions were mutation-verified by deleting
the sidecar sentence and the UNDOCUMENTED clause from the real file: 3 of 18
tests went red, naming exactly the deleted instructions, and the file was
restored.

**Why.** "measureScope says pass" and "the build fails" are different claims,
the same distinction `negative-budget.test.mjs` makes for the oversized-topic
fixture, and a content check nobody has watched fail is a check that asserts
nothing.

## 11. Six tokens of headroom is accepted as sufficient

**The question.** 144 of 150 leaves four to six tokens of margin depending on
phrasing. `negative-budget.test.mjs` insists a must-FAIL fixture be decisively
over budget so a tokenizer nudge cannot flip it; the mirror question applies
here.

**The call.** Accept 144. Prefer phrasings at or under 145 during iteration
(148- and 147-token variants were rejected for margin alone, not for meaning).

**Why.** The asymmetry is real: the negative fixture's text is a stand-in for
arbitrary future corpus content, while this text is frozen in the repo and
measured deterministically under both declared encodings (o200k_base 144,
cl100k_base 144, the harness bills the larger). If a future encoding is added
to `ENCODINGS` and this text crosses 150 under it, the gate goes red and names
the encoding, which is the correct outcome rather than a silent pass.

## 12. Environment note: the Python suite could not run in this worktree

**The question.** The full-suite requirement, against a port this feature does
not touch.

**The call.** Ran and report: `@comprehendo/spec` 436/436, `@comprehendo/core`
548/548, `@comprehendo/registry-tools` 328/328, all green. The Python port did
not run: the default interpreter here is 3.10 (the package needs 3.11+, it
fails at `from typing import NotRequired` during collection, in every module,
before any test), and the 3.13 interpreter present has no pytest installed.

**Why.** Not a blocker and not caused by this build: the diff is two new files
under `packages/spec`, no Python file is touched, and the port reads the kit's
fixtures rather than `priming.md`. Recorded out loud rather than silently
counted as green.
