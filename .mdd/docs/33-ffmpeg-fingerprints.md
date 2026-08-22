---
id: 33-ffmpeg-fingerprints
title: ffmpeg Fingerprints
type: COMPONENT
path: Corpora / ffmpeg / Fingerprints
source_files: [corpora/ffmpeg/]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-6
depends_on: [21-fingerprint-index-matcher, 32-ffmpeg-corpus]
tags: [ffmpeg, stderr-pattern, fingerprint, cli-cryptic-errors]
test_files: []
known_issues: []
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

- [ ] `comprehend(stderr)` against real cataloged ffmpeg stderr output
      returns the correct twin.
- [ ] A property test mutating cataloged ffmpeg stderr strings degrades
      to honest UNSTRUCTURED, never a wrong fix.
- [ ] No cross-package fingerprint collision is introduced by the ffmpeg
      set (Submission Gate [29] lint).

## Dependencies

- [21-fingerprint-index-matcher](21-fingerprint-index-matcher.md)
- [32-ffmpeg-corpus](32-ffmpeg-corpus.md)

## Known Issues

None recorded at plan time.
