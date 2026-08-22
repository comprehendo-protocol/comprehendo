# Judgment log, 21-fingerprint-index-matcher

Decide-and-log calls made while building the static fingerprint index and its
matcher. Nothing here contradicts the feature doc, CC10 [20], or the RFC; each
entry says what was decided, why, and what would reverse it.

## 1. A second source file: `src/fingerprint-facets.ts`

The doc's `source_files` names one file. The single-file implementation landed
at 472 lines, over CLAUDE.md's "max 400 lines" and well over the build skill's
size gate (300 default, enforced hard at Phase 7), so it was split the way this
repo already splits the same shape: `twin.ts` (construction path) plus
`twin-validate.ts` (the pure, testable checks), stated in core's own header as
"one file does one job". `fingerprint.ts` keeps the surface and re-exports
everything, so Router & Precedence [22] still imports one module.

Chosen over trimming 70+ lines of the "why" comments this project's rules ask
for. The new file is inside this feature's own new package, so no sibling lane
can be touching it; the only cost is bookkeeping. **The orchestrator should
record `source_files: [packages/registry-tools/src/fingerprint.ts,
packages/registry-tools/src/fingerprint-facets.ts]` at Phase 7**, matching the
precedent of `13-docs-engine` (docs.ts + docs-vocabulary.ts).

## 2. The UNSTRUCTURED literals are duplicated, under a drift test

registry-tools takes no dependency on core's runtime module: it is a build-time
tool, the packages install independently (one lockfile each, no workspace
wiring), and a cross-package `../../core/src/*` import from `src/` would break
`rootDir` and the package's own build. So `SPEC_VERSION`, `UNSTRUCTURED_CODE`
and `UNSTRUCTURED_REASON` are copied, and per the duplication rule the copy owes
a test asserting both values match: `test/unstructured-shape-drift.test.ts`
reads `packages/core/src/twin.ts` and `twin-validate.ts` and asserts the
literals and the emitted shape verbatim, plus the required fields of
`packages/spec/kit/shapes/twin.schema.json`. This is the same source-scanning
mechanism core's own CC1/CC9 tests use.

Reversal: if Wave 7 gives the monorepo real workspace wiring, import core's
`unstructuredTwin` and delete both the copies and this test.

## 3. Candidates ride in `accepts`, not a new twin field

CC10 requires the UNSTRUCTURED to say which cataloged fingerprints were
considered and rejected. `twin.schema.json` already has the field for exactly
this ("Valid alternatives; this is what carries did-you-mean"), so candidates
are named there as `package#corpusEntryId` strings, and the richer per-facet
detail (`matched`, `rejectedOn`) rides on the `MatchResult`, outside the twin,
where the router can use it without changing a spec-owned shape. `accepts` is
absent (not empty) when nothing was close, so "nothing was considered" and
"something was considered" are distinguishable.

## 4. Message patterns are a literal-plus-`*` language, never a RegExp

Corpus text is data, never instructions. A corpus-supplied regular expression
would be a backtracking hazard at registry build time and an escaping question
forever, and the project's own rule forbids building a `RegExp` out of input.
The pattern language is therefore literal text with `*` as the only
metacharacter, anchored at both ends, matched by an indexOf scan that is linear
per segment. It is enough for the real corpora shapes ("Unknown encoder '*'")
and it has one obvious canonical form, which is what makes collision detection
exact.

## 5. An unobservable facet is a rejection, not a shrug

If an entry declares a `stackShape` and the raw value carries no stack (stderr
text), or declares an `errorClass` and none can be observed, the facet counts as
REJECTED, so the entry cannot be a confident match. Precision-first: a facet
that cannot be confirmed has not been confirmed. The consequence is visible and
tested: the same stderr text that matches a message-only corpus is an honest
miss against a class-carrying one.

## 6. Two or more full matches is an ambiguity, with no tie-breaking

No specificity ranking, no "more facets wins", no scoring at all. The doc's
"no heuristic drift" and CC10's "never a best guess" are only true if there is
no ranking function to drift. Candidates are sorted for deterministic
reporting only, never to pick one.

## 7. A within-package duplicate fingerprint also fails the build

The doc's Business Rule names the cross-package case. Two entries in ONE
package claiming the identical fingerprint have the same defect (nothing can
ever resolve them, and any resolution would be a silent pick), so the builder
refuses those too, with `crossPackage: false` on the collision record so
Submission Gate [29] can treat the two cases differently if it ever needs to.
An entry declared twice with the SAME id and facets is one entry, deduped, not
a collision (concatenated corpora are a normal thing to hand a builder).

## 8. An entry with no facet at all fails the build

`{ package, corpusEntryId }` with no `errorClass`, `messagePattern` or
`stackShape` would match everything or nothing depending on how it is read.
It is refused at construction with that wording, alongside empty packages,
empty ids and malformed stack shapes. Validation runs on `unknown`, so the same
function guards a hand-written corpus and an artifact loaded off disk.

## 9. `kind` keeps the static-pattern question open

The doc's Known Issue: who runs `static-pattern` matching (`wrap()`, a lint
integration, or both) is an open Wave-1 question and the index format must not
foreclose it. Entries carry an optional `kind` (`runtime-error` by default);
static-pattern entries are indexed, participate in collision detection under
their own kind, and are skipped by the runtime matcher, so they cannot make a
caught error ambiguous. Nothing here decides who runs them.

## 10. The property generator is hand-rolled and seeded

No property-testing library was added. `test/helpers/mutate.ts` is a mulberry32
PRNG plus five mutation kinds (substitute, truncate, insert, delete,
transpose); every case is addressed by an integer seed that the assertion
message prints, so a red case reproduces exactly. The suite runs ~600 mutations
of three cataloged messages plus field permutations, with vacuity guards
(`expect(count).toBeGreaterThan(...)`) so a generator that silently stops
generating fails instead of passing green.

Verified with teeth, not just green: patching `match()` to return a best
candidate instead of degrading turned 16 tests red (property suite plus the
example-based ambiguity and near-miss cases). The patch was reverted before
commit.

## 11. Serialization is part of this feature

The doc calls the index "compiled into a single static artifact at registry
build time", so `serializeIndex` / `parseFingerprintIndex` ship here: stable key
order, sorted entries, and the artifact is byte-identical for the same input in
any order (that is how "builds deterministically" is asserted). `parse` runs the
same refusals `build` runs, so a hand-edited artifact cannot smuggle a defective
entry past the gate.

## Not decided here (and deliberately not)

- Submission Gate [29]'s CI wrapper (Wave 5). This is the check it will call.
- Who runs `static-pattern` matching (see 9).
- How `@comprehendo/registry-tools` is published: the same Wave 7 deferral
  `packages/core` and `packages/spec` already carry (`private: true`).
