# Judgment log: 33-ffmpeg-fingerprints

Unattended build, wave 6, batch 2. 14 calls, no blockers.

Baseline before any change (this worktree, after an offline `npm ci` in
`packages/{registry-tools,spec,core}`): registry-tools 279/279,
core 548/548, spec 418/418.

After: registry-tools 303/303 (24 new), core 548/548, spec 418/418.
Nothing outside `packages/registry-tools/test/` was touched, and
`corpora/ffmpeg/` is byte-identical to the wave branch.

## 1. No new source, so the Red Gate is discharged by mutation, not by placeholders

Every Acceptance Criterion here is a claim about code that already
exists (32's corpus, 21's matcher and builder, 29's lint, 22's router).
A skeleton asserting `expect.fail('MDD skeleton')` would go red for a
reason that has nothing to do with the claim, and would go green the
moment it was pointed at the real thing. So the Red Gate is discharged
the way 32 discharged its own claims: each new suite was proved to have
teeth by breaking the thing it asserts and watching it go red, then
reverting. Three mutations, all reverted, tree verified clean after
each:

| mutation | red |
|---|---|
| loosen `FFMPEG_UNKNOWN_ENCODER`'s pattern from `*Unknown encoder '*'*` to `*encoder*` (over-broad, now also matches the odd-dimension blob) | 9 of the 24 new tests, all three suites |
| patch `fingerprint.ts`'s matcher to guess the entry whose longest literal segment still appears in the text, instead of degrading (the CC10 violation itself) | 2 (both oracle-agreement tests) |
| patch `fingerprint.ts` to stop throwing on a collision | 2 (both collision-teeth tests) |

Worth recording from mutation 2: the "never a DIFFERENT entry" property
did NOT catch the guessing matcher, because the guess usually lands back
on the entry the mutation started from. The oracle-agreement property is
what has teeth against guessing. A suite carrying only the first property
would have passed a matcher that violates CC10 outright.

## 2. AC1 was not actually covered by 32, so it was built rather than referenced

Checked before deciding. 32's `ffmpeg-induction.test.ts` routes real
stderr through 21's real index to the right entry, and
`ffmpeg-corpus.test.ts` carries one blob on through 12's real twin
builder. Neither crosses the seam this doc's API/Interface names:
`comprehend(stderr)` on Router & Precedence [22]. So the index-level
half is referenced (not duplicated), and the missing half is built:
`ffmpeg-comprehend-surface.test.ts` writes the real packed artifact into
a real project tree, runs core's real `discoverInstalledCorpora` and
`createRouter`, and calls `comprehend` on all twelve real inductions.

## 3. The corpus is mounted through 23's `local` knob, not through a faked install

`@comprehendo/ffmpeg` is not published, and inventing a
`node_modules/@comprehendo/ffmpeg` would be the same fabrication 32
refused for `verifyAgainstUpstream` (its judgment call 5). `local` is
the supported way to run an unpublished corpus, and discovery puts a
mounted corpus into the SAME environment and the SAME compiled index as
an installed one, so no part of the routing path is special-cased by the
choice.

## 4. The mutation target is the cataloged LINE, in situ in its real blob

A real ffmpeg failure is a blob: banner, input description, stream
mapping, the one line that says what went wrong, then its echo. A
near-miss is not "a character somewhere in that blob moved", it is "the
line the corpus fingerprinted came out slightly different". So the
generator mutates that line and the raw handed to the matcher is the
whole real blob with that line replaced, which is what an agent holding
a failed invocation actually has. `catalogedLine` throws when two lines
carry the cataloged fragment, because replacing one and leaving the
other would let the pattern stay satisfied and the property would pass
having tested nothing.

## 5. CLI-shaped mutation kinds, on the seam a pattern draws

Not character-level alone (that is `mutate.ts`'s job for the JavaScript
domain, and it is reused here as one kind of seven). ffmpeg failure text
bakes its operands into the middle of the sentence, and those operands
are exactly what a pattern's `*` deliberately does not pin, so the kinds
split along that seam: `operand` / `path` / `number` move what must
still be recognised, `word` / `drop` / `char` damage what must not be,
`splice` welds two cataloged failures together. Same mulberry32 PRNG as
`mutate.ts` (imported, not re-rolled), same reproduce-from-the-seed
discipline, no property-testing dependency added.

Observed distribution over 2038 trials, 240 seeds per entry:
operand 240/240 and path 80/80 still route home, number 158/160,
char 127/394, drop 39/444, word 36/432, splice 26 home / 66 honestly
elsewhere / 37 ambiguous / 159 miss. Zero wrong twins.

## 6. `splice` is oracle-guarded; the strict law is asserted for the local kinds

A splice can honestly carry another entry's entire text (cut the source
line to nothing, keep all of the other one). Answering THAT with the
other entry's twin is correct, not a wrong fix, so holding splices to
"never another entry" would have been asserting a false law and the
threshold would have had to be fudged. The universal law asserted
instead is the oracle one: a confident answer is always exactly the one
entry a naive re-derivation of 21's Business Rules justifies. The strict
"never a different entry" law is asserted for the six local kinds, where
it does hold.

## 7. In this domain, an honest MISS names no candidates, and that is not a defect

The doc's Business Rules say a near-miss "degrades to UNSTRUCTURED with
candidates named". With message-pattern-only fingerprints (which is what
a CLI corpus can declare, per 32's judgment call 8), a rejected entry has
`matched: []`, and the matcher only reports candidates with at least one
matched facet, so a miss carries no `accepts` at all. That is honest, not
a bug: with one facet there IS no partial evidence to name. Candidates
are named in the AMBIGUOUS case, and both real routes to that case are
proved with real text: two real cataloged failures in one stderr (all 66
pairs), and a second corpus whose pattern overlaps ffmpeg's. Suggested
`known_issues` entry for the doc at close-out, phrased as the domain fact
it is, not as a gap in the code.

## 8. Collision and overlap are different shapes, and only one is a lint finding

The lint refuses two corpora that declare the IDENTICAL fingerprint
signature. Two corpora declaring DIFFERENT patterns that one real stderr
satisfies at once (`*: No such file or directory*` is generic enough that
another CLI corpus plausibly could) is not a build-time defect: neither
pattern is wrong, so nothing at build time can name a culprit. The honest
answer is owed at runtime, and it is UNSTRUCTURED naming both entries.
Both are proved with the real gate: the collision fails it and compiles
no index at all, the overlap passes it clean and degrades at match time.
Recorded here as the reach of the lint, deliberately not "fixed": a lint
that rejected overlapping patterns would reject legitimate corpora.

## 9. The deliberate collision is planted in ONE toy twin, not all of them

First cut rewrote every toy twin to the ffmpeg pattern and produced an
INTRA-package collision, which the gate caught for the wrong reason and
would have made the cross-package assertion pass vacuously. Found because
the overlap test went red. One twin now, which is also what a real
colliding submission looks like.

## 10. The operand-degradation guard is `> 0`, on purpose

Of 480 operand-family mutations, 478 still route home and exactly 2
degrade, both from the generator hitting the one numeral the catalog
really pins (`width not divisible by 2`). The guard was kept rather than
dropped: without it, "operands still route home" would be satisfiable by
a generator that changed nothing load-bearing. It is deterministic, not
flaky; if it ever goes red, the generator has stopped reaching a pinned
literal and a human should look.

## 11. No shared helper was edited

`coreModule` in `test/helpers/authored-corpus.ts` accepts only
`'docs' | 'twin'`. Widening it to `'router'` would have meant editing a
shared helper this feature's doc does not own, with a sibling feature
(34) building concurrently. The surface suite therefore loads core's
router by file URL itself, eight lines duplicated from the same pattern.
The duplication is the cheaper of the two, and it is visible.

## 12. Every fixture is real, and nothing was typed by hand

The corpus is `corpora/ffmpeg/` through 28's real `parse`; the
fingerprints are 29's real `fingerprintsOf`; the index is 21's real
`buildFingerprintIndex`; the colliding and overlapping corpora are real
trees written by 17's real `runInit`/`runScan`/`writeCorpus`; the stderr
is what the really-installed `ffmpeg 4.4.2-0ubuntu0.22.04.1` really wrote
this run. The only hand-written literal in the three suites is the
overlapping pattern `*No such file or directory*`, which stands for a
corpus that does not exist yet and could not be loaded from anywhere.

## 13. No fingerprint needed changing, so `corpora/ffmpeg/` was not touched

The doc's `source_files` is the corpus directory, which 32 authored. All
twelve patterns survive every property in this build, so editing them
would have been change for its own sake. `git diff` against the wave
branch is empty for `corpora/`.

## 14. Environment note: the Python port's suite cannot run here

`packages/python` needs Python 3.11+ (`typing.NotRequired`); this box's
default `python3` is 3.10 and the 3.13 interpreter has no pytest and no
network to install one. Pre-existing, and this build touched zero Python
files, so it is recorded rather than treated as a regression. The three
JavaScript suites (registry-tools, core, spec) all run and are green.

## Entry surface, live

Built both packages (`npm run build`, dist is gitignored) and ran a plain
node script, no test runner, against the real binary:

```
corpora discovered: [ 'ffmpeg' ] defects: []
ffmpeg exit: 1
comprehend(stderr) -> {
  "code": "FFMPEG_ODD_DIMENSION",
  "fixes": [
    { "title": "Fence: derive the width with -2, which rounds to even and cannot express an odd value",
      "apply": { "-vf": "scale=-2:720" } },
    { "title": "Runbook: round both axes explicitly when neither is derived" } ]
}
uncataloged exit: 1 -> code: UNSTRUCTURED fixes: 0
docs("ffmpeg","scaling") -> scaling
```

## For the close-out (Phase 7 is the orchestrator's)

`test_files` this build actually wrote:

- packages/registry-tools/test/ffmpeg-fingerprints.property.test.ts
- packages/registry-tools/test/ffmpeg-fingerprint-collision.test.ts
- packages/registry-tools/test/ffmpeg-comprehend-surface.test.ts
- packages/registry-tools/test/helpers/ffmpeg-mutate.ts
- packages/registry-tools/test/helpers/ffmpeg-stderr.ts
