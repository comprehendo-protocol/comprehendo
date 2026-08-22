# Judgment log, 17-corpus-generator

Decide-and-log calls made during the unattended build. Anything blocking would
have stopped the run instead of appearing here.

## J1. The corpus file format: a separate authoring format, plus a `pack` bridge

**The doc problem.** Architecture and Data Model attribute the generated file
shape to "Corpus Format [28]", a Wave 5 component that does not exist. Meanwhile
[13-docs-engine](.mdd/docs/13-docs-engine.md) already defined and shipped a real
versioned runtime artifact (`packed: 1`) and its doc states "Corpus Generator
[17] must emit exactly this".

**Decision.** `init` / `scan` / `diff` operate on a five-file AUTHORING format
defined concretely by this feature (`corpus_authoring: 1`), which is upstream of
and strictly richer than 13's runtime format. A fourth verb, `pack`, compiles the
authoring corpus into 13's `packed: 1` artifact and validates the result through
13's own `parsePackedCorpus`.

**Why the authoring format cannot be 13's packed format.** Three structural
reasons, each independently decisive:

1. `parsePackedCorpus` refuses a topic with an empty `summary` and refuses a
   topic serving no vocabulary. The defining property of `scan` output is that
   unfillable fields carry `status: stub`. A stub-bearing artifact is therefore
   *by construction* not loadable by the runtime this doc depends on. If scan
   wrote packed JSON directly, its own primary output would be an artifact the
   depended-on runtime rejects.
2. `packed: 1` has no slot for twins, fixes, or throw-site fingerprints. This
   feature's What-to-Build says `scan` pre-fills "throw/raise sites as twin
   skeletons with exception types pre-filled in fingerprints". Targeting packed
   directly would silently drop half the stated job.
3. `packed: 1` carries no field-ownership metadata. "A re-scan never touches
   human-owned fields" (the feature's must-not) is unimplementable without a
   place to record which fields are machine-owned, which are human-owned, and
   which are still stubs.

**Why `pack` is in scope rather than deferred to [28].** Without it, 13's shipped
doc contains a false statement about this feature (it names 17 as the producer of
the packed artifact), and 13's doc is not a file this feature owns, so the
inconsistency could not be fixed from here. `pack` is ~120 lines, it is the only
thing that proves the authoring format is *sufficient* to produce the runtime
format (an authoring format nobody ever compiled is an unverified guess), and it
gives Wave 2's demo state ("docs answering all three vocabularies from a packed
corpus") a real producer. Corpus Format [28] remains the Wave 5 registry-scale
formalization; both formats are version-gated (`corpus_authoring: 1`,
`packed: 1`) exactly so [28] can supersede either without guessing.

**Not built, deliberately** (recorded as `[deferred]` known_issues on the doc):
Submission Gate [29] stub rejection (Wave 5), the CC4 [26] folklore backstop
(Wave 5), Upstream Watch [34] CI wiring (Wave 6). `pack` refusing to emit a
stub-bearing topic is NOT the submission gate: it is the packed format having no
representation for a stub. The gate is a policy about what may be published;
this is an encoder reporting what it cannot encode.

## J2. Ownership rule: one rule, not per-field heuristics

Machine-owned fields are regenerated wholesale on every `scan`. Human-owned
fields are written by `scan` only while they are still stubs, and never again,
even when the underlying code changed (that drift is what `diff` reports). This
single rule satisfies both the must-not and the acceptance criterion "a second
scan leaves human-owned fields byte-identical", and it avoids the trap where a
docstring-derived DRAFT summary that a human then edited gets clobbered by the
next scan because its status still said "draft".

Consequence, also deliberate: when an export disappears, `scan` never deletes the
topic file (that would destroy human-owned prose). It marks the index entry
`orphaned: true`, machine-owned, and `diff` reports it.

## J3. Zero-dependency scanner instead of the TypeScript compiler API

`typescript` is a devDependency, and CLAUDE.md makes "zero runtime dependencies
in the core (scanned in CI)" a hard constraint. A module under
`packages/core/src/` importing `typescript` would make the compiler a runtime
dependency of the published core package. The scanner is therefore a small
self-contained lexer over the target's source text (comment-blanking, paren
matching, line tracking), the same technique the package's own CC1/CC9 scans
already use in `test/helpers/source-scan.ts`.

It is honest about being grep-level rather than a type checker: it reads
exported declaration headers, the JSDoc block immediately above them, and
`throw new X(...)` sites. What it cannot resolve (a re-exported symbol from a
barrel, an inferred return type) it does not guess at, it leaves a stub. That is
the same trade the CC1 scan already makes in this package, and it keeps the
zero-dependency guarantee intact.

## J4. `bin` wiring left to Distribution (Wave 7)

The CLI entry point is `packages/core/src/cli/main.ts` (shebang, argv dispatch,
documented exit codes) and it is invoked live in this build as
`node dist/cli/main.js <verb>`. Adding `"bin": {"comprehendo": ...}` to
`packages/core/package.json` was NOT done: that file is outside this feature's
`source_files`, 14-sdk-entry is building against the same package concurrently,
and how this package assembles into the published `comprehendo` npm package is
already declared a Wave 7 decision in the package's own description. Recorded as
a `[deferred]` known issue naming the owner.

## J5. `scan` on a missing corpus errors instead of auto-initialising

`init` scaffolds, `scan` fills. A `scan` pointed at a package with no corpus
exits 2 with a message naming `init`, rather than silently doing init's job. Two
verbs that each do the other's work make `init`'s "refuses to overwrite" promise
meaningless.

## J6. Output goes through an injected writer, never `console.*`

The logging rule bans bare `console.*` in application code. A CLI's stdout is its
product, not a log, but the rule is worth honouring anyway: every verb takes a
`write` callback (defaulting to `process.stdout.write`), which is also what makes
the verb output assertable in unit tests without capturing global state.

## J7. Toy target fixture is real TypeScript on disk, in two versions

`test/fixtures/toy-target/` (v1) and `test/fixtures/toy-target-next/` (v2, the
"new upstream version" `diff` runs against) are real, valid, strict-mode
TypeScript files, so they are typechecked and linted by this package's own gates.
A fixture that does not compile would make the scanner's input unrepresentative
of the code it will actually meet. The spec's `mongodb-operator` kit fixtures
were deliberately left alone; they belong to `packages/spec`.

## J8. One Red-Gate skeleton was retargeted rather than implemented

The init skeleton "opens every scaffolded record as a stub, never silently
blank" describes nothing real: `init` scaffolds no records at all (filling them
is `scan`'s job), so that assertion could only ever have passed vacuously. It
was retargeted to init's actual promise, "opens an empty menu plus the manifest
hint, and invents no content", with the reason written into the test body. The
skill's own rule for a skeleton whose assertion is empty is to fix the
assertion, never delete it.

## J9. Two tests were added after the Red Gate

`cli-diff.test.ts` gained "refuses to diff a package with no corpus, naming
init" and the pack suite covers the same precondition, both error paths that the
skeleton set had only for `scan`. They would have been red at the gate (the
functions did not exist), and an error path with no test is the kind of absence
a diff review cannot see.

## J10. A CLI piped into `head` must not crash

Found while smoke-testing: `comprehendo scan pkg | head` raised an unhandled
EPIPE and printed a crash report. stdout closing early is a normal way to use a
CLI, so the default writer swallows the write error and the process exits 0.

## J11. Line numbers are excluded from every drift comparison

A twin's identity (`id`) and the drift comparison both exclude line numbers.
Code moving down a file is formatting, and a drift report that fires on it
teaches its reader to ignore it, which is worse than not reporting. The moved
line is still recorded in the machine-owned `fingerprint.source`, so nothing is
lost.

## J12. Two temp directories, real files, no mocked filesystem

Every verb test copies the toy target into a fresh temp directory and runs the
real verb against real files. No `fs` mocking anywhere: a corpus generator whose
tests never wrote a file would prove nothing about the thing it exists to do.
