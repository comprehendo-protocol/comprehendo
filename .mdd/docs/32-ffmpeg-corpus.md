---
id: 32-ffmpeg-corpus
title: ffmpeg Corpus
type: COMPONENT
path: Corpora / ffmpeg / Corpus
source_files: [corpora/ffmpeg/]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-6
depends_on: [26-cc4-folklore-gate, 28-corpus-format]
tags: [ffmpeg, pitfall-catalog, fence, heal, runbook, corpus-samples, flagship]
test_files: []
known_issues: []
---

# ffmpeg Corpus

## What to Build

The flagship pitfall catalog for ffmpeg, mined from unanswered-thread
corpora (support threads, issue trackers, unanswered forum posts),
dispositioned entry by entry into fences (the mistake cannot be
expressed), heals (fixed silently and safely), or runbooks (the twin with
steps), in that preference order. Every fix induced against real ffmpeg
in CI (CC4 [26]). Seeded in part by the existing `corpus-samples/ffmpeg`
worked example (cryptic-CLI case). Must-not: no folklore entry (an
uninduced twin code or fix) ships (CC4 [26]).

Scope decision: the source spec names three worked corpus samples
(openai-python for training-lag, zod for fresh-migration, ffmpeg for
cryptic-CLI) as seeds for "the corpus file format and the registry's
first entries." This doc, and the Wave 6 build order, narrow that to
ffmpeg only, because the spec's own Build Order section commits Wave 6
explicitly and solely to the ffmpeg flagship demo. The openai-python and
zod samples remain corpus-format seed material (already used to shape
Corpus Format [28] and, for zod, the `static-pattern` fingerprint
question on Fingerprint Index & Matcher [21]) but are not built into
published registry corpora by this wave plan; authoring them is future
registry-community work, not tracked as a feature here.

## Architecture

`corpora/ffmpeg/`, in the Corpus Format [28] shape (one topic per file,
twins/fixes as JSON). Built and validated through the same Submission
Gate [29] path as any community corpus, proving one discipline for both
tiers even though this is the project's own flagship.

## Implementation Notes

- Fences and heals outrank runbooks: before writing a runbook twin for a
  cataloged ffmpeg pitfall, the corpus author asks whether the mistake
  can instead be made unexpressible (a fence) or silently corrected (a
  heal). The runbook is the fallback, not the default.
- The bulk of the wave-6 estimate (5-7 days) is this corpus-authoring
  work, deliberately staged after Wave 5's registry so the flagship
  exercises the whole submission pipeline rather than a hand-wired
  special case.
- Real CI induction against actual ffmpeg (likely containerized) is
  required for every entry; a pitfall mined from a thread but never
  reproduced does not become a catalog entry.

## Data Model

Same corpus shape as Corpus Format [28]: topic markdown files with YAML
headers, `twins.json`, `fixes.json`, specialized to ffmpeg's CLI-flag and
stderr-pattern domain.

## API/Interface

N/A directly; this corpus is consumed through `comprehend(stderr)` and
`docs('ffmpeg', query)` (Router & Precedence [22]) once installed as
`@comprehendo/ffmpeg`.

## Business Rules

- Every twin code and fix is induced against real ffmpeg in CI, never
  hand-asserted (CC4 [26]).
- Every failure is dispositioned fence, heal, or runbook, with fence and
  heal preferred over runbook.
- Every entry is mined from a real, citable pitfall source (a thread,
  issue, or the corpus-samples seed), not invented.

## Acceptance Criteria

- [ ] Every cataloged ffmpeg fingerprint reproduces against real ffmpeg
      in CI.
- [ ] Every cataloged fix resolves its induced failure on retry, in CI.
- [ ] The corpus passes Submission Gate [29] with no folklore rejections.
- [ ] At least one fence and one heal exist in the catalog (not runbooks
      exclusively).

## Dependencies

- [26-cc4-folklore-gate](26-cc4-folklore-gate.md)
- [28-corpus-format](28-corpus-format.md)

## Known Issues

None recorded at plan time.
