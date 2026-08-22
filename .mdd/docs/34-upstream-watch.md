---
id: 34-upstream-watch
title: Upstream Watch
type: COMPONENT
path: Corpora / ffmpeg / Upstream Watch
source_files: [corpora/ffmpeg/upstream-watch.lock]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-6
depends_on: [32-ffmpeg-corpus]
tags: [upstream-watch, lock-file, drift-detection, generalized-pattern, wrapper-over-tool-not-owned]
test_files: []
known_issues: []
---

# Upstream Watch

## What to Build

A lock file over the wrapped surface: the flags, behaviors, and stderr
strings the ffmpeg corpus depends on. An ffmpeg release that changes any
locked surface fails the watch loudly, rather than being silently
absorbed and leaving the corpus quietly wrong. Built on `comprehendo
diff`'s drift-report mechanism (Corpus Generator [17]). This is the
generalized pattern every wrapper over a tool it does not own inherits,
not an ffmpeg-only mechanism.

## Architecture

`corpora/ffmpeg/upstream-watch.lock`, generated and checked by re-running
Corpus Generator [17]'s `comprehendo diff` against the newest ffmpeg
release in CI on a schedule (or on a new-version trigger). Feeds CC4
[26]'s drift-failure path: a locked surface that changed makes the
corresponding fix un-inducible, and CC4 already treats that as a drift
failure, not a silent pass.

## Implementation Notes

- The lock file's scope is deliberately narrow: only the flags,
  behaviors, and stderr strings the corpus's cataloged fingerprints and
  fixes actually depend on, not ffmpeg's entire CLI surface.
- This is explicitly named in the source spec as a pattern other future
  wrapped-tool corpora (any `@comprehendo/<pkg>` sidecar over a tool the
  registry does not control) should reuse, so the lock format should not
  be hand-tuned to ffmpeg specifics beyond what ffmpeg's stderr shape
  actually requires.
- The submission-gate policy for hostile or rapidly-moving upstream
  surfaces (an open Wave-5-relevant question, see Submission Gate [29]'s
  Known Issues) is directly informed by how well this lock file performs
  in practice.

## Data Model

Lock entry: `{ flag | behavior | stderrPattern, lockedVersion,
observedAt }`, one per surface element a cataloged fingerprint or fix
depends on.

## API/Interface

N/A directly; runs as a CI job, not called by agents or providers.

## Business Rules

- Every locked surface element traces to at least one cataloged
  fingerprint or fix in ffmpeg Corpus [32]; the lock file never grows
  beyond what the corpus actually depends on.
- A new ffmpeg release that changes a locked surface fails the watch job
  loudly, naming the changed element, never silently passing.
- A watch failure routes into CC4 [26]'s drift-failure handling, not a
  separate silent-ignore path.

## Acceptance Criteria

- [ ] The lock file enumerates every flag, behavior, and stderr pattern
      the ffmpeg corpus's cataloged entries depend on.
- [ ] A synthetic upstream change to a locked surface fails the watch job
      with the specific element named.
- [ ] The watch job runs on a schedule or version-bump trigger, not only
      manually.

## Dependencies

- [32-ffmpeg-corpus](32-ffmpeg-corpus.md)

## Known Issues

None recorded at plan time.
