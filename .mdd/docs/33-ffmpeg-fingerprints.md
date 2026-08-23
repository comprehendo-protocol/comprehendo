---
id: 33-ffmpeg-fingerprints
title: ffmpeg Fingerprints
type: COMPONENT
path: Corpora / ffmpeg / Fingerprints
source_files: [corpora/ffmpeg/]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-6
depends_on: [21-fingerprint-index-matcher, 32-ffmpeg-corpus]
tags: [ffmpeg, stderr-pattern, fingerprint, cli-cryptic-errors]
test_files: [packages/registry-tools/test/ffmpeg-fingerprints.property.test.ts, packages/registry-tools/test/ffmpeg-fingerprint-collision.test.ts, packages/registry-tools/test/ffmpeg-comprehend-surface.test.ts, packages/registry-tools/test/helpers/ffmpeg-mutate.ts, packages/registry-tools/test/helpers/ffmpeg-stderr.ts]
known_issues:
  - "[deferred] With message-pattern-only fingerprints (the only facet a CLI corpus can declare, per 32's judgment call 8), an honest MISS names no candidates at all: the matcher only reports candidates with at least one matched facet, and one facet gives no partial evidence to name on a reject. This is a domain fact, not a bug; candidates ARE named in the AMBIGUOUS case, proved with real text both ways (66 real two-cataloged-failure blobs, and a real overlapping-pattern corpus)."
  - "[deferred] Fingerprint collision (identical pattern) and pattern OVERLAP (different patterns, one real stderr satisfies both) are different shapes, and only collision is a build-time lint finding. An overlap is not a defect in either pattern, so nothing at build time can name a culprit; the honest answer is UNSTRUCTURED naming both entries at match time, which is proved with the real gate (collision fails and compiles no index; overlap passes clean and degrades honestly at match time). A lint that rejected overlapping patterns would reject legitimate corpora."
  - "[deferred] The comprehend(stderr) surface suite duplicates ~8 lines loading core's router by file URL rather than widening authored-corpus.ts's coreModule helper ('docs' | 'twin' only) to add 'router', since that helper is outside this doc's source_files and a sibling feature (34) was building concurrently. The duplication is visible and cheaper than a shared-file edit."
  - "[gap] Found by review: the oracle-agreement property (judgment call 1) is only proven against a guess that operates INSIDE the matcher's own candidate/facet bookkeeping (the natural in-scope guess, and the one this build's own mutation actually tests). A guessing heuristic operating outside that machinery entirely (e.g. raw substring scoring against the whole registry, ignoring facets) is not proven caught by either property. Not a false claim (the doc never claimed universal guess coverage), but a real, narrow scope boundary worth knowing."
  - "[gap] Found by review: the mutation-distribution table recorded in the wave-6 job manifest's judgment log (word/drop/char/splice counts) is a snapshot of one run, not a reproducible invariant. The generator itself is deterministic given a seed and an input line; the INPUT varies run to run because catalogedStderr() induces fresh real ffmpeg output each time (a deliberate choice: real stderr every run, never a frozen fixture), and environment-dependent content (heap pointer digit runs) shifts which spans are available to mutate. The qualitative structure (operand/path near 100% home, word/drop/char degrading heavily, splice split across all four outcomes) holds reliably; the exact per-kind counts do not."
---

# ffmpeg Fingerprints

## What to Build

The stderr-pattern fingerprints for every failure cataloged in ffmpeg
Corpus [32], compiled through Fingerprint Index & Matcher [21]'s static
index builder. ffmpeg's error surface is notoriously cryptic CLI stderr
text (the corpus-samples seed's whole reason for existing), so this is
the first real proof that the matcher handles a hostile, message-pattern
-heavy domain rather than the toy-package fingerprints used in Wave 4.

## Architecture

Built via Fingerprint Index & Matcher [21] against ffmpeg Corpus [32]'s
cataloged failures. Matched at runtime by Router & Precedence [22] when
`comprehend(stderr)` is called against ffmpeg's raw stderr text.

## Implementation Notes

- ffmpeg failures are dominated by message-pattern matching (stderr text)
  rather than error-class names or stack shapes (ffmpeg is a CLI, not a
  library with a JS/Python stack), so this is the fingerprint kind this
  corpus stresses hardest.
- CC10 [20]'s honest-miss guarantee is exercised directly here: an
  ffmpeg stderr string that resembles but does not exactly match a
  cataloged pattern must degrade to UNSTRUCTURED, never a wrong flag fix.

## Data Model

Fingerprint entries scoped to `package: 'ffmpeg'`, `messagePattern`
-dominated (per Fingerprint Index & Matcher [21]'s shape), one per
cataloged ffmpeg failure.

## API/Interface

N/A directly; reached through `comprehend(stderr)` (Router & Precedence
[22]).

## Business Rules

- Every ffmpeg fingerprint reproduces against real ffmpeg stderr output
  in CI (CC11 [25], CC4 [26]).
- A near-miss stderr string (a mutated or unrelated ffmpeg error)
  degrades to UNSTRUCTURED with candidates named, never a wrong flag fix
  (CC10 [20]).

## Acceptance Criteria

- [x] `comprehend(stderr)` against real cataloged ffmpeg stderr output
      returns the correct twin. 32 proved this at the index/twin
      -builder level but never crossed Router & Precedence [22]'s own
      seam; `ffmpeg-comprehend-surface.test.ts` closes that gap: the
      real packed artifact mounted through Config Loader [23]'s
      `local` knob (no fabricated `node_modules/@comprehendo/ffmpeg`
      install), core's real `discoverInstalledCorpora`/`createRouter`,
      `comprehend(stderr)` on all twelve real inductions. Verified
      live through built `dist/`: `comprehend(stderr)` on a real odd
      -dimension failure returns `FFMPEG_ODD_DIMENSION` with its real
      fence and runbook fixes; a real uncataloged failure (h264 into
      ogg) returns honest `UNSTRUCTURED`, 0 fixes; `docs('ffmpeg',
      'scaling')` answers `scaling`.
- [x] A property test mutating cataloged ffmpeg stderr strings degrades
      to honest UNSTRUCTURED, never a wrong fix.
      `ffmpeg-fingerprints.property.test.ts`: a seeded generator
      (mulberry32, same PRNG as 21's own property test) over 7 CLI
      -specific mutation kinds (operand/path/number, the axes a
      pattern's `*` deliberately does not pin; word/drop/char, what it
      does pin; splice, welding two cataloged failures together),
      2038 trials over the REAL corpus's real patterns and the real
      binary's real stderr, mutating the cataloged LINE in situ inside
      its real blob (never a synthetic string). Zero wrong twins; the
      universal law asserted is oracle-agreement (a confident answer
      always matches a naive re-derivation of 21's own Business
      Rules), not merely "never a different entry", because that
      weaker property did NOT catch a guessing matcher planted as a
      mutation (the guess usually lands back on the entry it started
      from). Verified to have teeth: patching the matcher to guess
      turns exactly the 2 oracle-agreement tests red.
- [x] No cross-package fingerprint collision is introduced by the
      ffmpeg set (Submission Gate [29] lint).
      `ffmpeg-fingerprint-collision.test.ts`: 29's real
      `fingerprintFindings`/`runSubmissionGate` over ffmpeg's real
      compiled fingerprints alongside real toy corpora Corpus
      Generator [17] actually wrote, both directions (a colliding PR
      corpus, and ffmpeg already published with a colliding PR
      arriving). Verified to have teeth: an identical-pattern
      collision fails the gate, names both packages, compiles no
      index at all; a deliberately-planted collision in exactly one
      toy twin (not all of them, to avoid a vacuous intra-package
      false positive) is what the teeth check targets.

## Dependencies

- [21-fingerprint-index-matcher](21-fingerprint-index-matcher.md)
- [32-ffmpeg-corpus](32-ffmpeg-corpus.md)
