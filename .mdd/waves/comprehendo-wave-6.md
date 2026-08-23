---
id: comprehendo-wave-6
title: 'The Flagship: ffmpeg'
initiative: comprehendo
initiative_version: 1
status: complete
depends_on: [comprehendo-wave-5]
demo_state: The headline demo runs end-to-end on camera -- an agent given only the priming snippet is asked to crop and transcode a video; its first wrong flag comes back through comprehend(stderr) as a twin whose fixes[0] works; its vocabulary questions answer through docs; the measured session lands within the token budget; first-correction rate on the scripted failure suite is published.
content_hash: a9d2e33fc0584af2
---

# Wave 6: The Flagship: ffmpeg

Estimate: 5-7 days (corpus authoring from the ffmpeg pitfall mine is the
bulk). Deliberately staged after the registry so the headline demo
exercises the whole pipeline, not a hand-wired special case.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 32 | ffmpeg Corpus | COMPONENT | 26, 28 |
| 33 | ffmpeg Fingerprints | COMPONENT | 21, 32 |
| 34 | Upstream Watch | COMPONENT | 32 |

## Demo-state Result (unattended run, 2026-08-22)

Executed against the real runtime, not asked for confirmation
(unattended mode). Result: **PARTIAL**, and the one unmet clause is
the one no automated run can meet.

- **"Its first wrong flag comes back through `comprehend(stderr)` as
  a twin whose `fixes[0]` works": MET, measured, not asserted.** A
  live script ran all 12 cataloged failures against the real ffmpeg
  4.4.2 binary in this session (real command per entry, real induced
  stderr, real `comprehend(stderr)` call through the real router over
  a real installed corpus): routing first-correction rate
  **12/12 = 100.0%** (every failure names the right twin on the first
  call), executable-fix first-correction rate **3/3 = 100.0%** (the
  fence and both heals resolve their induced failure on the first
  retry). The nine runbook-only entries have no `apply` to retry by
  design (Implementation Notes: a runbook's fix is an inert docs
  pointer, not a corrected command), so they count toward the routing
  rate only, honestly.
- **"Its vocabulary questions answer through docs": MET.**
  `docs('ffmpeg', <query>)` answers correctly across all seven
  topics, re-verified live in this session (`ffmpeg-comprehend-surface.test.ts`,
  and this wave's own final measurement script).
- **"The measured session lands within the token budget": MET.**
  Submission Gate [29]'s real tiktoken-class meter passes the whole
  corpus's `budget` check clean (`ffmpeg-corpus.test.ts`, "passes
  every check the gate runs, with none reported not-run"), re-run
  live in this session.
- **"First-correction rate on the scripted failure suite is
  published": MET, this section IS the publication.** No feature in
  this wave built a dedicated rate-publishing artifact, so the
  numbers above were computed live for this report rather than read
  from one: 12/12 routing, 3/3 executable-fix, both 100.0% against
  the real binary, script and full per-entry breakdown in this wave's
  PE4 record.
- **"The headline demo runs end-to-end on camera": DEFERRED TO HUMAN
  REVIEW.** An agent given only the priming snippet, filmed live,
  cropping and transcoding a real video, is a human production
  deliverable (an actual agent session, an actual camera), not
  something an automated wave-close run can execute or fake-confirm.
  Every mechanical precondition it depends on is proven above: the
  routing, the fixes, the docs answers, and the budget are all real
  and all pass. What remains is the recording itself.

Wave-6 exit gate confirmed in this session: `packages/registry-tools`
328/328, `packages/core` 548/548, `packages/spec` 418/418 unaffected.
Every adversarial-path test across all three features runs against a
real ffmpeg binary, real npm pack/install, or real corpus data, zero
mocks. Three real defects found by independent review and fixed, all
mutation-verified: 32's two fingerprint-precision findings (an
under-inclusive pattern missing a real, equally common failure
variant; an over-inclusive pattern silently misdirecting a caller),
and a stale lock-file entry at the 33/34 concurrent-build boundary
(34's builder started before 32's own review fix landed, the same
class of collision wave-4's 23/24 merge hit). One documentation
-accuracy finding corrected (34's CC4-routing claim, softened from
"live" to "proven-compatible, not yet wired into the shipped
workflow"). One package-wide reliability fix (a 5s default test
timeout too tight for a package that now spawns real subprocesses
throughout).
