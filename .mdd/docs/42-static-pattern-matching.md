---
id: 42-static-pattern-matching
title: Static Pattern Matching
type: COMPONENT
path: Fingerprinting / Static Pattern Matching
source_files: [packages/registry-tools/src/fingerprint.ts, packages/registry-tools/src/gate-fingerprint.ts, scripts/run-docs-code-blocks.ts]
status: complete
phase: all
last_synced: 2026-08-24
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [21-fingerprint-index-matcher, 37-docs-as-tests]
tags: [static-pattern, fingerprint-kind, second-index, docs-as-tests-fourth-shape]
test_files: [packages/registry-tools/test/fingerprint-match.test.ts, packages/registry-tools/test/fingerprint-collision.test.ts, packages/registry-tools/test/fingerprint-index.test.ts, packages/registry-tools/test/zod-corpus.test.ts]
known_issues:
  - "[gap] A `static-pattern` fingerprint's own facets (`errorClass`, `messagePattern`, `stackShape`) are unchanged from `runtime-error`'s vocabulary, reused rather than redesigned. `errorClass` in particular does not carry an honest meaning for a pattern (there is no thrown error to have a class), and `corpora/zod`'s own two static-pattern twins declare `messagePattern` only, never `errorClass`, for exactly that reason (see this doc's Fixed Issues, the mcp-oauth-era docs-as-tests raw-text mismatch that surfaced it). Whether `static-pattern` deserves its own, narrower facet vocabulary (dropping `errorClass`/`stackShape` from the format entirely for this kind) is Corpus Format [28]'s call, not made here: this feature resolved WHO RUNS a static-pattern fingerprint, not what facets it should be limited to declaring."
  - "[gap] `checkPattern`, an agent-facing surface in `packages/core` exposing `buildStaticPatternIndex` the way `comprehend(raw)` exposes the runtime-error index, is not built. Nothing in the RFC or this build asked for one yet; `corpora/zod` is proven entirely through `packages/registry-tools`'s own test suite and Docs As Tests [37]'s new `pattern` block shape, neither of which needed a new root-level export. Adding one is real, separate work for whenever a real caller needs to ask 'does this source snippet match a cataloged pattern' at runtime, outside a corpus's own gate."
  - "[deferred] `run-docs-code-blocks.ts`'s new `pattern` block shape matches a block's ENTIRE literal code text against the static-pattern index; it does not extract or normalize the snippet (strip whitespace, comments) before matching. `corpora/zod`'s own two patterns are single-line and do not exercise this; a multi-line or differently-formatted positive sample would need a messagePattern loose enough to tolerate that, or a normalization step this feature does not build."
  - "[deferred] `.mdd/waves/comprehendo-wave-7.md` and `.mdd/initiatives/comprehendo.md` were both edited to register this doc, following [41-corpus-discovery-cli](41-corpus-discovery-cli.md)'s own precedent (itself following [39-registry-reservations](39-registry-reservations.md)) for a feature landing after the formal wave build. Neither file's `content_hash` was recomputed for the same reason 41 records: the hashing tool is not available outside the interactive `/plan-execute`/`/plan-sync` skills. A `/plan-sync` pass in an interactive session should recompute both."
---

# Static Pattern Matching

## What to Build

`static-pattern`, one of Fingerprint Index & Matcher [21]'s two
`FingerprintKind`s, gets its own real, separate compiled index
(`buildStaticPatternIndex`) and its own real consumer, `corpora/zod`, the
first corpus to declare the kind and have it actually matched against
anything. Must-not: a `runtime-error` fingerprint and a `static-pattern`
fingerprint sharing identical literal facets must never collide with or
match against each other, in either direction, even when their text
coincides exactly.

This closes an open Wave 1 design question, carried in `fingerprint-
facets.ts`'s own comment since the kind was first declared: "`static-
pattern`... is an open Wave-1 design question: who runs it is not yet
decided, so the format carries it and the runtime matcher ignores it
rather than foreclosing the decision." Before this feature, a
`static-pattern` entry was parsed, validated by Corpus Format [28], and
then silently excluded from `buildFingerprintIndex`'s output at match
time; it had zero observable effect anywhere in the system.

## Architecture

The resolution: `runtime-error` and `static-pattern` are not two facets of
one shared index, they are two SEPARATE indices, compiled by the same
underlying matcher machinery (`fingerprint.ts`'s internal `buildIndexOfKind`,
parameterized by kind) but never mixed. `comprehend(raw)`'s own contract
(`router.ts`: "takes whatever the agent caught, an error object or bare
stderr text") is unchanged, zero behavior difference for every existing
caller and every existing test: `buildFingerprintIndex(entries)` still
means exactly what it always meant, a `kind`-less entry (every fingerprint
authored before this feature) still defaults to `runtime-error` (read at
filter time, never stamped onto the compiled entry, so the packed JSON
`buildFingerprintIndex` produces is byte-identical to before this feature
for any pre-existing corpus, verified live against `corpora/ffmpeg`).

`buildStaticPatternIndex(entries)` is the new, parallel export: same
`FingerprintIndex` shape, same precision-first `match()` (a facet an entry
declares must hold; ambiguity degrades to UNSTRUCTURED, CC10 [20]),
compiled from `kind === 'static-pattern'` entries only. A caller must ask
one function or the other on purpose; there is no combined "match
anything" call, deliberately: a source-code pattern's text accidentally
resembling a real stack trace (or the reverse) is a real risk this
separation removes structurally rather than trusting a corpus author's own
facet precision to avoid.

Submission Gate [29]'s fingerprint lint (`gate-fingerprint.ts`) checks BOTH
indices for cross-corpus collisions now; a corpus's `static-pattern`
fingerprint colliding with another corpus's `static-pattern` fingerprint
fails the PR the identical way a `runtime-error` collision always has, and
neither kind is checked against the other (by construction, not by a
special-cased skip).

Docs As Tests [37] gained a fourth worked-example shape for this kind,
`pattern`: unlike `sh`/`python`/`javascript` (all "spawn something real,
watch it fail"), a static-pattern fingerprint matches literal SOURCE TEXT,
never a caught runtime error, so there is nothing to spawn. A `pattern`
block's own code (not run, not tokenized) is matched, in-process, against
the corpus's real, compiled `buildStaticPatternIndex` result, the same
`FingerprintIndex.match()` every other shape ultimately calls. It requires
no precondition at all: no interpreter, no declared CLI, nothing is ever
spawned for it.

## Implementation Notes

- `buildIndexOfKind`'s own doc comment carries the full reasoning for why
  two indices rather than one filtered index (the earlier, REJECTED design:
  the ORIGINAL `buildFingerprintIndex` carried every entry regardless of
  kind and filtered inside `match()` at call time; a real Wave-7 review
  found this meant `buildStaticPatternIndex` naively built the same way
  would filter EVERY entry out of its own results, since `match()`'s
  hardcoded `!== 'runtime-error'` skip ran unconditionally; fixed by moving
  the kind filter to build time, once, and deleting it from `match()`
  entirely, see Fixed Issues).
- `corpora/zod`'s own two `runtime-error` twins declare no `errorClass`
  facet, unlike what a first draft assumed: `judge()`'s `errorClass` check
  can only be satisfied when the raw value observed is a record/Error with
  a `.name`, and Docs As Tests [37]'s `pattern`... no, `javascript` source
  blocks hand `run.stderr`, a bare STRING, to `context.index.match()`; a
  bare string never carries an observable `errorClass` (`observe()`'s own
  logic, `fingerprint-facets.ts`), so a fingerprint declaring `errorClass`
  can never fully match text-only induction. `ffmpeg`/`openai-python`/
  `mcp-oauth` all already avoid this by declaring `exception: ""`
  (empty) throughout; `corpora/zod` follows the same precedent, found the
  hard way (see Fixed Issues) rather than assumed from the start.

## Data Model

`FingerprintKind = 'runtime-error' | 'static-pattern'` (unchanged, already
declared in `fingerprint-facets.ts`). A `FingerprintEntry`'s `kind` field is
unchanged; what changed is which of two indices a compiled entry ends up
in.

## API/Interface

```
buildFingerprintIndex(source: Iterable<unknown>): FingerprintIndex   // unchanged
buildStaticPatternIndex(source: Iterable<unknown>): FingerprintIndex // new
```

Both re-exported from `fingerprint.ts` (already `export *`s
`fingerprint-facets.ts`, so `FingerprintKind` was already public).

## Business Rules

- A `kind`-less fingerprint entry is `runtime-error`, read at index-build
  time, never written onto the compiled entry: `buildFingerprintIndex`'s
  output for a pre-existing corpus is byte-identical to before this
  feature.
- `runtime-error` and `static-pattern` never share an index. A collision
  check runs per kind, never across kinds.
- A `static-pattern` fingerprint's evidence standard under CC4 [26] is
  honestly different from a `runtime-error` one (there is no process to
  spawn), never lower: a real, live-checked behavioral or compile-time
  claim stands in for a real caught error (`corpora/zod/README.md`'s own
  "Real evidence backs both kinds" section states the standard this
  feature holds a `static-pattern` twin to).

## Data Flow

A corpus author declares `kind: "static-pattern"` on a twin's fingerprint
(Corpus Format [28], unchanged authoring shape) -> the fingerprint compiles
into `buildStaticPatternIndex`'s output, never `buildFingerprintIndex`'s ->
Submission Gate [29] checks both indices for collisions -> Docs As Tests
[37] verifies a `pattern`-language worked example's own text against the
compiled static-pattern index.

## Dependencies

- [21-fingerprint-index-matcher](21-fingerprint-index-matcher.md)
- [37-docs-as-tests](37-docs-as-tests.md)

`gate-fingerprint.ts` (Submission Gate [29]'s own `source_files`, not a
dependency in the contract sense) gained a second, parallel collision
check for the static-pattern index; this is the same kind of file-shared
touch [37]'s own doc already models against `docs-transcript-workspace.ts`
and `run-docs-code-blocks.ts`, no new contract, no `satisfies_contracts`
entry (this feature calls neither `verifyAgainstUpstream` nor any other
29-declared mandatory contract function).

## Security

No network code, no telemetry: `buildStaticPatternIndex` is a pure,
in-memory compile step over corpus data already resident, identical
posture to `buildFingerprintIndex`. Corpus text stays data, never
instructions: a `static-pattern` fingerprint's `messagePattern` is a glob
matched literally, the same restriction every other fingerprint facet
already carries, never a regular expression a corpus could smuggle
anything through.

## Acceptance Criteria

- [x] A `kind`-less entry still compiles into `buildFingerprintIndex`'s
      output exactly as before; `corpora/ffmpeg`'s own generated
      `COMPREHENDO.md` is unaffected.
- [x] A `static-pattern` entry never appears in `buildFingerprintIndex`'s
      output; a `runtime-error` entry never appears in
      `buildStaticPatternIndex`'s output. Proven by a real test
      (`fingerprint-match.test.ts`).
- [x] A real corpus (`corpora/zod`) declares both kinds, induces every
      twin of both kinds live (`zod-corpus.test.ts`), and passes
      Submission Gate [29] with zero violations, including a real
      fingerprint-collision check against all three previously merged
      corpora in BOTH indices.
- [x] Docs As Tests [37] executes a `static-pattern` twin's worked example
      for real (matched against the real compiled index, not spawned);
      `corpora/zod`'s COMPREHENDO.md is 4/4 for real.
- [x] Mutation-verified: a deliberately mismatched `messagePattern` (the
      near-miss case) does not match; reverting the kind-separation
      change reproduces the original silent-empty-index bug exactly.

## Fixed Issues

### `buildStaticPatternIndex`'s naive first draft filtered its OWN entries out, because `match()` still hardcoded the old runtime-error-only check (fixed 2026-08-24)

Found building `corpora/zod`, the first real consumer: the ORIGINAL
`buildFingerprintIndex` (before this feature) filtered `entries` inside
`match()` at CALL time (`if ((entry.kind ?? 'runtime-error') !==
'runtime-error') continue;`), not at BUILD time. A first draft of
`buildStaticPatternIndex` reused that same `match()` unchanged, which meant
every static-pattern entry it correctly compiled into `.entries` was then
IMMEDIATELY filtered right back out again the instant `.match()` was
called, because the hardcoded check still only ever kept `runtime-error`
entries. The new index would have compiled successfully and then matched
nothing, forever, the identical silent-failure shape the whole feature
exists to close.

- Fixed by moving the kind filter to BUILD time (`buildIndexOfKind`, one
  new function that both `buildFingerprintIndex` and
  `buildStaticPatternIndex` call, parameterized by kind) and deleting the
  filter from `match()` entirely: `match()` now trusts its caller's own
  compiled set completely, which is correct because build time is the only
  place kind is decided at all.
- Verified live: `buildStaticPatternIndex(corpora/zod's entries)
  .entries` carries exactly the 2 static-pattern twins;
  `buildFingerprintIndex` of the same entries carries exactly the 2
  runtime-error ones and zero of the static-pattern ones.
- Mutation-verified: reverted the build-time filter, confirmed
  `fingerprint-match.test.ts`'s "carries the static-pattern entry" test
  failed exactly as expected (empty `.entries`), restored, green.

### `corpora/zod`'s runtime-error twins declared `errorClass`, and Docs As Tests [37]'s text-only induction can never satisfy it (fixed 2026-08-24)

Found running `run-docs-code-blocks.ts corpora/zod` for the first time:
both javascript-language worked examples failed, "routes to no cataloged
failure (miss)", even though the real, live stderr text visibly contained
every literal fragment the twin's own `messagePattern` named. Root cause:
the twins also declared `exception: "ZodError"` / `"TypeError"`
(`errorClass`), and `judge()`'s precision-first rule requires EVERY
declared facet to match. `invokeJavaScript`'s `Invocation.stderr` is a bare
STRING (Node's own uncaught-exception output, not a structured object), and
`observe()` can only read an `errorClass` off a record with a `.name` or a
real `Error` instance, never a bare string. A `messagePattern` match alone
could never be enough while an unsatisfiable `errorClass` facet stood next
to it; the entry was permanently a near-miss, never a full match, against
ANY text-only induction path.

- Fixed by dropping `errorClass` from both runtime-error twins, matching
  the precedent every prior corpus (`ffmpeg`, `openai-python`,
  `mcp-oauth`) already set (`exception: ""` throughout, relying on
  `messagePattern` alone). `packages/registry-tools/test/zod-corpus.test.ts`
  additionally proves each twin's fingerprint routes correctly through a
  SECOND induction path (a direct, structured `{name, message}` catch,
  where `errorClass` WOULD be observable) as a belt-and-braces check that
  is not itself relying on the fragile assumption.
- Mutation-verified: reverted just the `errorClass` removal, confirmed both
  javascript blocks failed again with the exact "no cataloged failure"
  message, restored, `run-docs-code-blocks.ts corpora/zod`: 4/4.
