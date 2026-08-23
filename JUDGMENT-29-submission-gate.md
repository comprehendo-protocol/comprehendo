# Judgment log, 29-submission-gate

Every call made without asking, and why. Decide-and-log applies to the small
ambiguous ones; nothing here rose to a blocker. Two findings that belong to
OTHER features are recorded rather than acted on: the corpus-format slot the
witness mechanism wants (call 3) and doc [20]'s now-unblocked acceptance
criterion (call 18).

---

## 1. The CI job lives in the registry repo; this feature is the check logic

**The question.** The doc describes "the CI job that runs on every registry
corpus PR against `comprehendo-protocol/registry`", with CODEOWNERS per corpus
directory and a merge bot. None of that repository exists in this codebase.

**The call.** Build the reusable check logic here, in
`packages/registry-tools/src/gate*.ts`, and build no workflow file, no
CODEOWNERS file and no bot automation.

**Why.** A GitHub Actions workflow committed into THIS repository would never
fire: there are no corpus PRs here, so the file would be decoration that reads
as infrastructure. The trust ladder is not skipped for the same reason it is
not faked: it is implemented as `mergePolicy`, a pure function over the PR
facts CI can supply, so the registry repo's job is a thin caller and the rules
themselves are testable and tested here. Recorded in the feature doc's Known
Issues, out loud, rather than left as an implied gap.

## 2. The gate does not install; CI installs, and the gate verifies

**The question.** CC11 [25] says "CI installs the actual target package" and
calls the verb load-bearing. Should `verifyAgainstUpstream` shell out to `npm
install`?

**The call.** No. `verifyAgainstUpstream` takes `installRoot`, a real
node_modules tree, resolves the package out of it, loads it and calls it.

**Why.** CC6 [27] says registry-tools contains zero network imports, and the
CC1 [07] forbidden list that scan is shaped from includes `child_process`.
`npm install` is both a network call and a child process, so a gate that ran it
would violate the contract the same gate enforces. The install is genuinely
CI's own step (one workflow line), and nothing about the claim weakens: the
suite really runs `npm pack` and `npm install --offline` (in the TEST, where
child_process is fine), and the gate then really loads and really calls the
unpacked package. The verb stays load-bearing; only the caller changes.

## 3. The witness, and the format gap it names

**The question.** To induce a cataloged failure you need the call that
provokes it. Nothing in the authoring corpus format carries one: a fix's
`apply` is the call that AVOIDS the failure, and the inverse is not derivable
from it. 17's scanner records `raised_by` (the function containing the throw)
but not the arguments that reach it, and Corpus Format [28]'s `parse` does not
even surface that field.

**The call.** Inducing calls arrive as `witnesses` on `UpstreamOptions`,
supplied by the PR alongside the corpus, and the gate trusts none of them: a
witness is a claim that gets RUN, and a witness that does not reproduce is a
named failure (`not-inducible`, `misrouted`, `unrunnable-witness`). The
missing format slot is recorded as a `[gap]` on this feature's doc, naming
what it would be.

**Why.** The alternative was to invent the slot inside `corpus-source.ts`,
which is Corpus Format [28]'s file and outside this feature's `source_files`;
per the lane rules that is a blocker to be reported, not a file to edit. The
witness-as-input design loses nothing today (CI supplies it either way) and
keeps the honest property: the corpus never asserts its own coverage.

## 4. Folklore diffs OBSERVED coverage, never declared coverage

**The question.** CC4 [26] says the gate "diffs the catalog against induced
coverage". Where does the coverage come from?

**The call.** From `verifyAgainstUpstream`'s return value, which is what the
gate itself observed while calling the real package. No corpus field, no
author declaration, and no "coverage report" the PR can hand in.

**Why.** 26 is explicit that provoked means an actual test actually triggering
the failure and actually observing the twin and the fix, "not a hand-written
assertion that the shape looks plausible". Any input a submitter can write is
an assertion. Making the gate's own run the only evidence is the reading with
teeth, and it costs nothing, because the gate already has to run the package
for CC11.

## 5. A docs-pointer fix is provoked by its twin's induction

**The question.** CC4 says every fix needs a test that induces the failure,
applies the fix and asserts success on retry. A fix that is an inert docs
pointer has nothing to apply.

**The call.** A fix with an `apply` is provoked only by a run that applied it
and saw the retry succeed. A fix with only a `docs` pointer is provoked exactly
when its twin was really induced and its pointer resolves (28's `validate`
owns the pointer half). When the twin was not induced, the pointer fix is
named as folklore too.

**Why.** The rule cannot mean "execute the unexecutable", and the two wrong
answers are worse: exempting pointer fixes entirely makes them a hole an
author walks through, and rejecting them entirely deletes the preferred fix
shape for anything CC7 [09] will not let an apply express. This version still
fails: `gate-folklore.test.ts` proves a pointer fix goes red the moment its
twin loses its witness. Stated in the code comment where the decision lives,
not only here.

## 6. Drift and folklore are different findings

**The call.** A twin that was witnessed and no longer reproduces is reported
as DRIFT; a twin that was never witnessed is reported as folklore. Never both,
and never the same sentence.

**Why.** 26 calls drift a first-class failure mode, and the two have different
authors: drift is an upstream release changing under a corpus that was correct
when written, folklore is an entry nobody ever proved. Telling an author who
broke nothing that they wrote folklore is how a gate teaches people to ignore
it. The suite asserts the drift message does not contain "no inducing test".

## 7. `not-run` is a third check outcome, and it enforces the contract

**The question.** What does the gate report when it was handed no upstream
verification, or no CC5 meter?

**The call.** `not-run`, which is not `pass`, and `pass` is `every check ===
'pass'`. A gate run without `verifyAgainstUpstream` results reports
`registryTruth` and `folklore` as `not-run` and can never be `publishable`.

**Why.** This is what makes this feature's mandatory
`integration_contracts` entry structural instead of a calling convention:
Scoped Publisher [31] cannot obtain a publishable result without having called
`verifyAgainstUpstream` first, so the contract cannot be forgotten, only
violated loudly. Collapsing `not-run` into a boolean is precisely how a
skipped verification becomes a green build.

**A narrowing, stated.** The outcomes are PR-level, not per-corpus: if one
corpus in a multi-corpus PR could not be measured, `budget` reads `not-run`
for the whole run. The findings carry the corpus each belongs to, so nothing
is ambiguous in the report; only the summary is coarse.

## 8. Danger-lint justification is a docs pointer that names the operation

**The question.** CC11 says a destructive `apply` "requires explicit
justification". The corpus format has no justification field.

**The call.** The justification is the fix's `docs` pointer, and it counts
only when the topic it resolves to actually contains the destructive token.
A destructive apply with no pointer, or with a pointer to a topic that never
mentions the operation, is a violation. A justified one still raises
`elevatedReview`, so a bot never lands it without core approval.

**Why.** "Has a docs pointer" alone would be satisfied by every fix in every
well-formed corpus, which is a check that reports green in exactly the failing
case. Requiring the pointed-at topic to name the operation is checkable, is
about the actual danger, and is the strongest thing the format as it stands can
express. The missing dedicated field is recorded as a `[gap]`.

## 9. The destructive and instruction tables are floors, and say so

**The call.** `DESTRUCTIVE_OPERATIONS` matches whole TOKENS of an operation
name (so `purgeFrames` is destructive and `transform` is not),
`DESTRUCTIVE_OPERANDS` catches the flags that make an ordinary call
destructive (`-y` is the flagship case: ffmpeg's "overwrite the output without
asking" is invisible to any check that reads operation names only), and
`INSTRUCTION_PHRASES` is a fixed phrase table.

**Why, and the honesty clause.** No table here can be complete, and the file
says that in its header rather than implying a ceiling. What makes the floor
worth having is that these failures are silent otherwise, and that token-
boundary matching buys the floor without false positives on ordinary corpus
prose (the whole authored fixture passes all three lints untouched).

## 10. The injection lint rejects second-person prose, deliberately

**The question.** "You must pass a non-empty payload" is ordinary technical
writing. Is it an injection finding?

**The call.** Yes. `you must`, `you should`, `always run` and their neighbours
are in the table.

**Why.** CC11's rule is not "no prompt injections", it is "corpus text is
about the tool, never addressed to the agent". Second-person imperative prose
IS addressed to the agent, which makes it the rule's subject rather than a
false positive, and the line between "you must call encode with a payload" and
"you must call encode with the operator key" is exactly the line an attacker
works. The cost is real and is recorded as a `[gap]`: a corpus author has to
write "encode refuses an empty payload" instead of "you must not pass an empty
payload", and ffmpeg Corpus [32] is the first feature that will feel it.

## 11. The telemetry scan is scoped to executable content, plus two prose rules

**The call.** Forbidden-module references and URLs are refused in EXECUTABLE
content (worked-example code, and `apply` payloads, where a URL is refused
outright). Prose is scanned only for the exfiltration builtins (`fetch(`,
`sendBeacon`, `XMLHttpRequest`, `WebSocket`, `EventSource`).

**Why.** A corpus documenting an HTTP client has to be able to say "http" and
to link upstream documentation; refusing that would make CC6 unenforceable at
the tier where it matters, because the rule would be disabled for the packages
it most applies to. What a corpus must never do is ship a runnable example that
opens a socket, or an apply naming an endpoint, and those are what this scans.
A worked example that legitimately streams from a URL would trip nothing here
unless it also calls a network builtin; recorded as a `[gap]` since the
flagship ffmpeg corpus may eventually want one.

## 12. `fingerprintsOf` duplicates `pack`'s mapping, held by an agreement test

**The question.** The fingerprint lint needs a corpus's compiled entries.
`pack` produces them, but `pack` refuses a corpus that does not validate.

**The call.** A local `fingerprintsOf`, with a test asserting it equals
`pack(corpus).fingerprints` for a real corpus.

**Why.** A cross-corpus collision is a fact about the registry, and it has to
stay visible in a corpus that fails some unrelated rule; gating the lint on
`pack` would hide collisions behind a typo. Exporting the mapping from
`corpus-format.ts` would be editing Corpus Format [28]'s file, outside this
lane. The duplicate-plus-agreement-test pattern is the one this package
already uses for the UNSTRUCTURED literals and the front-matter dialect, and
the load-bearing detail it protects is the same one 28 flagged: a packed
fingerprint's `corpusEntryId` is the twin's published CODE, never 17's
authoring id.

## 13. The CC5 meter is a port, not a copy of the budget numbers

**The question.** `packages/spec/kit/budget` is JavaScript with a
`js-tiktoken` dependency, registry-tools declares `rootDir: src` and takes no
dependency on `@comprehendo/spec`, so `src/` cannot import it.

**The call.** `BudgetMeter` is a function the caller supplies; the suite wires
the REAL `measureScope` in by dynamic import, exactly the way these suites
already load core's modules, and the gate reports `budget: not-run` when no
meter arrives.

**Why.** The two alternatives were both worse: copying the budget numbers into
this package breaks CC5's one-way ratchet (the numbers would have two homes and
one of them would drift up), and approximating the count with a
character-or-word proxy is wrong by 3x to 5x on real corpus content, which the
kit's own tokenizer test demonstrates. A port with a `not-run` outcome keeps
the real tokenizer as the only thing that ever answers.

## 14. 28's open question, settled: a stub-bearing corpus is submittable, never mergeable

**The question.** Corpus Format [28] left it explicitly to this feature:
"whether a PR carrying stubs may be SUBMITTED at all is Submission Gate [29]'s
policy".

**The call.** Submittable, never merge-eligible. Stubs are reported as
`corpusFormat` findings, so the gate is red, `publishable` is false, and
`mergePolicy` refuses a bot merge; nothing rejects the PR itself.

**Why.** A corpus is written over several pushes and the gate is the author's
feedback loop; refusing to run on a draft turns the loop off exactly when it is
most useful. What must not happen is a stub reaching a published artifact, and
that is already unrepresentable (28's `pack` refuses one), so the policy adds
the middle rung rather than a second wall.

## 15. The result carries more than the doc's Data Model literally lists

**The call.** `checks` keys the doc's seven plus `dangerLint`, `injectionLint`,
`telemetryScan` (all three named in the doc's own Business Rules or its
dependencies) and `corpusFormat` (everything else 28's `validate` reports).
The result also carries `publishable`, `findings` (the structured form of
`violations`) and `index`.

**Why.** Every addition is a widening, never a narrowing: the doc's named
checks all exist under their exact names, and `violations: string[]` is exactly
the doc's shape. `index` is there because the doc's own acceptance criterion
says a passing submission's fingerprint index is BUILT, which is only
observable if the gate hands it back.

## 16. Dynamic `import()` in `gate-upstream.ts` is not a CC6 violation

**The call.** The default module loader dynamically imports the installed
package by file URL, and it is isolated behind a `ModuleLoader` port in one
file.

**Why.** CC6 forbids network code. `import()` of a local file path in a
node_modules tree is not network code, and there is no other way to load an
installed module at all; the alternative is not verifying anything. It is
worth naming because core's docs-engine scan forbids `import(` inside THAT
module set (a runtime engine that should never load anything dynamically), and
someone reading both files should not have to guess why the rule differs: this
is a build-time verifier whose entire job is loading the package under test.

## 17. `misrouted` is a distinct failure from `not-inducible`

**The call.** A witness whose call really throws, and whose thrown failure
really matches a DIFFERENT cataloged entry, is `misrouted`, not "not
inducible".

**Why.** 25's threat model is routing hijack ("so routing cannot be hijacked
by claiming another package's error patterns"), and that attack looks exactly
like a witness that reproduces something. Reporting it as "cannot be induced"
would describe a corpus that induces a failure perfectly well as one that
induces nothing, and would hide the fact that matters: which entry the failure
actually belongs to.

## 18. Doc [20]'s deferred acceptance criterion is now satisfiable, and is reported, not edited

**The finding.** `20-cc10-honest-miss.md`'s third acceptance criterion is
`[ ] ... [deferred] Genuinely blocked on Submission Gate [29] (Wave 5), which
does not exist yet: there is no registry BUILD step to fail.` That step now
exists: `fingerprintFindings` runs 21's real collision detection over one index
built from the PR's corpora plus the corpora already on main, and
`gate-corpus-checks.test.ts` proves a cross-package collision fails the gate
with both packages named, including a collision with a corpus the PR never
touched.

**The call.** Report it to the orchestrator; do not edit `20`'s doc. It is
outside this lane's ownership (this build was authorised to check off 25's and
26's boxes specifically), and a backward sweep across another wave's docs is
Phase 7 bookkeeping.

## 19. Ten files, and the doc's `source_files` updated to match

**The call.** The doc named one file, `gate.ts`. The feature is ten, split by
responsibility (result vocabulary, policy, format partition and orchestration,
upstream resolution, induction, folklore, the content lints, the telemetry
scan, the fingerprint lint, the budget port), and the doc's `source_files` now
lists all ten.

**Why.** The same call Corpus Format [28] made one feature earlier, for the
same reason: a single 1,500-line `gate.ts` would break the size gate and, more
to the point, would bury the two security-critical parts (the apply-execution
path and the lint tables) inside a walk over corpora. Every file here is under
250 lines and every function under 50.

## 20. Two toy targets carry different throw-site texts

**The call.** The fixture templates the toy package's error messages with the
package name, so `toy-encoder` and `toy-tagger` do not share fingerprints.

**Why.** A fingerprint SIGNATURE deliberately excludes the package (that is
what makes a cross-package collision detectable at all), so two toy corpora
sharing a literal message would collide by accident and every two-corpus suite
would be testing the wrong thing. The collision suites now create the collision
on purpose, by rewriting one corpus's pattern to the other's.
