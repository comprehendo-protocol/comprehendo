# Judgment log, 28-corpus-format

Every call made without asking, and why. Decide-and-log applies to the small
ambiguous ones; nothing here rose to a blocker, and the two findings that
belong to OTHER features' source files are recorded as known issues on this
doc rather than fixed here (see calls 4 and 5).

---

## 1. The packed artifact is ONE file, not a ratification of 22's three

**The question.** Router & Precedence [22] shipped a provisional convention:
three artifacts (`comprehendo.fingerprints.json`, `comprehendo.twins.json`,
`comprehendo.packed.json`) plus an optional `comprehendoCorpus.target` key,
and recorded in its Known Issues that this component owns the real ruling.
Two defensible answers: ratify the three files (nothing to migrate) or rule
the single artifact this doc's Data Model describes.

**The call.** One artifact, `comprehendo.corpus.json`, `corpus_packed: 1`,
carrying `docs`, `twins` and `fingerprints`.

**Why.** Three reasons, in order of weight:

1. The feature doc is explicit and it is the ruling document: "the whole
   corpus compiled to a single packed artifact at publish time so runtime
   never walks directories", "a single versioned binary/JSON artifact
   containing the compiled topic index, all topic bodies, twins, and fixes,
   loaded once at runtime". Ratifying three files would be narrowing a
   business rule to match what already shipped, which is exactly the class of
   decision the judgment protocol says not to make quietly.
2. Three files is three chances to ship half-updated. The failure mode is
   specific and silent: a fingerprint file naming a twin code the catalog
   file no longer carries MATCHES and then answers UNSTRUCTURED. An atomic
   artifact makes that state unrepresentable.
3. 22's own doc calls the convention provisional and names this component as
   the ruler. A provisional convention nobody ever rules on is how a
   convention becomes a format by accident.

**What it costs, stated out loud.** `packages/core/src/router-discovery.ts`
still reads the three provisional names and does not know
`comprehendo.corpus.json`. That file is outside this feature's `source_files`
and core is not this lane's to edit, so the migration is recorded as a known
issue on this doc naming the exact file and function. Nothing regresses: 22's
suites build their own corpora, and no published corpus exists yet
(Scoped Publisher [31] is the first producer, and it depends on this doc).

## 2. No compatibility emitter for the three provisional names

**The question.** Should `pack` ALSO emit the three provisional-name files,
mechanically derived from the single artifact, so core's shipped reader keeps
working?

**The call.** No.

**Why.** registry-tools takes no runtime import from core, so a compatibility
emitter could not be tested against the reader it exists for: I can build the
three files, but nothing in this package can drive
`discoverInstalledCorpora` over them to prove they are read correctly. The
project's own discipline settles it, "every fix is provoked by a real test in
CI or it does not ship". An untestable shim is folklore, and folklore that
touches the publish path is the worst place to keep it. The one-line
migration in core, done by whoever owns that file, is honest; a shim I cannot
prove is not.

## 3. JSON, not a binary encoding

**The question.** The doc says "binary/JSON" and 17's doc records the encoding
as an open Wave-1 question.

**The call.** JSON, `corpus_packed: 1`, pretty-printed with a trailing
newline (`serializeCorpus`).

**Why.** Zero runtime dependencies is a scanned CI constraint, so any binary
encoding would have to be hand-rolled in both TypeScript and Python and pass
the identical conformance kit (CC2 [01]). The corpus is also reviewed as a
diff in a pull request (Submission Gate [29]'s whole channel model), and a
published artifact a reviewer cannot read is a channel that loses its review
property. The version number is the actual answer to the open question: a
binary encoding can arrive as `corpus_packed: 2` and `readPackedCorpus`
already refuses an unknown version by name rather than reading it lossily.

## 4. `declared_schema` is a new slot in the authoring format

**The question.** CC7 [09] checks a fix's `apply` against "the provider's
declared call schema". The five-file authoring format Corpus Generator [17]
writes has NO slot for one, anywhere: `manifest.json` carries provider,
target and manifest hint, and nothing else. Without a schema, every `apply`
in every corpus is uncheckable, which would make CC7 unenforceable at the
registry tier.

**The call.** `manifest.json` gains `declared_schema:
{surface, operations[], nested_pipeline_operations?}`, read by `parse`,
optional, and required only when some fix actually carries an `apply`.
Snake-case to match the authoring format's own spelling (`manifest_hint`,
`stub_fields`, `message_pattern`).

**Why.** The format is this component's to define, and a machine cannot
derive a provider's declared call surface, so it is a human-owned field by
nature. Making it optional means every corpus 17 has ever written still
parses and validates unchanged; only a corpus that carries an `apply` owes
one.

**The finding this surfaced, recorded as a known issue.** 17's `writeCorpus`
rewrites `manifest.json` wholesale from `{header, target, manifest_hint}`, so
a hand-added `declared_schema` is silently DROPPED by the next `comprehendo
scan`. That contradicts 17's own central rule ("a re-scan never touches a
human-owned field"), and there is no placement in the authoring format that
avoids it, because every one of the five files is fully rewritten. The fix is
one field carried through 17's `readCorpus`/`writeCorpus`; both are outside
this feature's `source_files`, so it is written down rather than done. The
test helper adds the key after 17's writer runs, exactly as an author has to
today, so the suite exercises the real situation rather than a fixed one.

## 5. An `apply` with no declared schema is a violation, not a pass

**The call.** `undeclared-call-schema`, rule CC7.

**Why.** This is the same reasoning core's `applyOperations` already applies
to an unparseable apply: `null` is not "no operations", it is "this cannot be
checked". A corpus whose apply cannot be checked is not a corpus whose apply
is safe, and CC7 is the security fence, so silence is the wrong default. The
alternative (skip the check when there is no schema) makes the fence
optional by omission, which is how a control becomes decoration.

## 6. `corpusEntryId` is the twin's published CODE, not 17's authoring id

**The question.** 17's twins carry a stable authoring `id`
(`src/encode.ts#encode#RangeError#input-must-not-be-empty`) AND a published
`code` (`TOY_EMPTY_INPUT`). 21's fingerprint entry carries one
`corpusEntryId`. Which one goes in?

**The call.** The code.

**Why, and it is load-bearing.** `packages/core/src/router.ts:147` resolves a
match with `builder.twinFor(match.entry.corpusEntryId, raw)`, and `twinFor`
looks the code up in the catalog. Binding the id instead does not throw, does
not warn, and does not fail any type: the fingerprint matches, the catalog
lookup misses, and the router hands back UNSTRUCTURED for a failure the
corpus fully documents. That is the exact silent half-failure this format
exists to prevent, so it gets its own test and its own header comment.
Mutation-verified: binding the id turns 2 tests red.

## 7. `validate` returns data; `pack` throws

**The call.** `validate(corpus): readonly CorpusViolation[]`, never throwing
on a bad corpus. `pack(corpus)` runs `validate` itself and throws
`CorpusFormatError` carrying the violations.

**Why.** The two consumers want opposite things. Submission Gate [29] parses
a PR's corpus and renders EVERY finding into one review comment, so it needs
the list; a gate that raises on the first violation makes a corpus author fix
one finding per CI run, which is how a submission channel dies. Scoped
Publisher [31] must never publish an unvalidated corpus, and the doc's
business rule ("`validate` runs before `pack`") is only a rule if it is
structural: as a calling convention it holds until exactly one forgetful
caller. Putting the call inside `pack` satisfies both. Mutation-verified:
removing the check turns 3 tests red.

## 8. The reason vocabulary is core's, held by an agreement test

**The question.** CC7 and CC3 are enforced twice: natively by
`validateCatalog` in `packages/core/src/twin-validate.ts`, and here for the
registry tier. registry-tools takes no runtime import from core (the packages
install independently; a `../../core/src` import from `src/` breaks
`rootDir`), so the rule is implemented a second time.

**The call.** Reuse core's exact `reason` strings, and hold the duplicate with
an AGREEMENT test rather than a literal-comparison test: the suite loads
core's REAL `validateCatalog`, runs it over the same corpus through
`catalogOf`, and asserts this gate reports every reason the native one does.
A second test hands `catalogOf`'s output to core's REAL `createTwinBuilder`
and asserts it is accepted.

**Why.** 21 set the precedent (duplicate + drift test) for two string
literals. A security fence deserves more than string equality: what matters
is that the two tiers reach the same verdict, and only running both can show
that. "One discipline, two tiers" (CC7's own words) is now a claim the suite
can fail.

## 9. Stubs are detected here, and refused at pack; POLICY stays with 29

**The call.** `validate` reports every `status: stub` field as a `stub-field`
violation. `pack` therefore refuses a stub-bearing corpus.

**Why.** 17's doc defers stub REJECTION to Submission Gate [29], and this
does not take that decision: 29 decides whether a PR carrying stubs may be
submitted at all, which is a policy about people. What this component
enforces is narrower and structural, the same thing 17's own `pack` enforces:
the packed format has no representation for a field nobody wrote, so the
encoder reports what it cannot encode. 29 gets the list and applies its
policy.

## 10. CC3's raw-error-leak check is keyed on the throw-site message pattern

**The call.** A twin whose `reason` CONTAINS its own fingerprint
`message_pattern` verbatim is a `raw-error-leak` (rule CC3).

**Why.** Core checks `reason.includes(rawTextOf(received))`, and an authoring
corpus has no `received`. But it has the throw site's actual message, which
IS the raw text a scan recorded, so an author pasting it into `reason` ships
precisely the leak CC3 [08] exists to prevent: the raw error as the primary
answer instead of the explanation. Skipped when the pattern is empty or still
a stub, and skipped for a pattern carrying wildcards would be the next
refinement if a real corpus ever needs it. Mutation-verified: 1 test red.

## 11. The front-matter reader is duplicated, with a two-parser agreement test

**The call.** `corpus-front-matter.ts` re-implements the reader half of 17's
YAML subset (no emitter: registry tooling never writes an authoring file).
The drift test parses a topic file 17 REALLY wrote with both parsers and
asserts they produce the same mapping and the same body.

**Why.** Same one-way-dependency constraint as call 8. Comparing the two
parsers on a real file is a much stronger claim than comparing two constants,
and it goes red on any dialect change rather than only on a renamed literal.

## 12. `stack_shape` and `kind` added to the authoring fingerprint

**The call.** The authoring twin fingerprint may carry `stack_shape` (a list
of frame markers) and `kind` (`runtime-error` | `static-pattern`), both
optional, both passed straight through to the packed entry.

**Why.** 21 defines three facets and the format previously exposed two, so a
corpus could not express the third at all. And 21's Known Issues explicitly
say the index format "should not foreclose" the open `static-pattern`
question, which a format with no slot for `kind` would do. Neither is
invented: both are read from the corpus only, never derived. Deliberately NOT
derived: `raised_by` is a function name at the throw site, and turning it
into a `stackShape` would add a facet the author never declared, which is a
guess, and precision-first forbids guessing.

## 13. Six files, not one

**The call.** `corpus-format.ts` (surface, packed artifact, `pack`),
`corpus-source.ts` (`parse`, the only filesystem walk), `corpus-validate.ts`,
`corpus-apply.ts` (the CC7 fence), `corpus-violation.ts` (the refusal shape
and reason vocabulary), `corpus-front-matter.ts`.

**Why.** The feature doc names one `source_files` entry, and the first draft
of `corpus-validate.ts` came in at 435 lines, over CLAUDE.md's 400-line
limit. The split follows the precedent the doc's own dependencies set
(`twin.ts`/`twin-validate.ts`, `fingerprint.ts`/`fingerprint-facets.ts`): the
pure, security-critical, most-testable part gets its own file. `source_files`
on the doc is updated to the six. Largest file after the split is 337 lines;
the package's existing `fingerprint.ts` is 326, so this is in line with the
package, not an outlier.

## 14. Two test edits AFTER the red gate, both recorded

**14a, a wrong expectation of my own helper.** Three tests asserted a topic
summary of `'What encode does, in one topic-sized answer.'`. That was wrong
about the HELPER, not about the implementation: `completeCorpus` only fills a
summary that is still a stub, and 17's `scan` had already filled this one
from the target's docstring. Corrected to assert the topic file's own prose
body, which is the stronger assertion (it reads the real file rather than a
constant). No implementation was changed to make them pass.

**14b, a coverage gap mutation testing found.** After green, I mutated six
behaviors to check the suite has teeth. Five turned tests red. The sixth,
disabling the `docs` half's own version gate in `readPackedCorpus`, left the
suite entirely green: the artifact carries two version numbers and only one
of them was tested. Added one test for it rather than shipping an untested
gate. The rerun turns it red.

Mutation results, for the record (each reverted after measuring):

| mutation | suite |
|---|---|
| fingerprint bound to authoring id, not published code | 2 red |
| `pack` skips `validate` | 3 red |
| CC7 apply check disabled | 4 red |
| one-topic-per-file disabled | 1 red |
| stub refusal disabled | 1 red |
| docs half not version gated | 0 red -> test added -> 1 red |
| stray topic files not reported | 2 red |
| raw-error-leak disabled | 1 red |
| orphan fixes not reported | 1 red |
| code fences not tracked in the topic scan | 1 red |
| `declared_schema` never read | 6 red |

## 15. Every corpus under test is one Corpus Generator [17] really wrote

**The call.** `test/helpers/authored-corpus.ts` writes a real toy target
package to a real temp directory and runs 17's REAL `runInit`, `runScan`,
`readCorpus` and `writeCorpus` over it, loaded by dynamic `import()` of core's
actual source at run time. No fixture is typed to agree with the parser under
test.

**Why.** The acceptance criterion is "`parse` correctly reads the five-file
corpus shape produced by Corpus Generator [17]". A fixture I typed would
prove that `parse` reads what I believe 17 writes, which is the one thing
that cannot be assumed. The mechanism is not new: core's own suites load THIS
package's matcher exactly this way (`test/helpers/sidecar.ts`,
`fingerprintModule`), so the direction is reversed and nothing else is.

## 16. Environment: `node_modules` symlinked into the worktree

The worktree was created without dependencies installed. `packages/{core,
spec,registry-tools}/node_modules` are symlinked to the main checkout's
(identical `package.json`s, and `node_modules/` is gitignored). Nothing is
committed. Recorded because it is the reason the suites run at all here.

**Pre-existing, untouched:** `packages/python`'s pytest suite fails collection
on 17 errors in the main checkout too (no interpreter environment installed).
Not caused by this build, not in scope, not fixed.
