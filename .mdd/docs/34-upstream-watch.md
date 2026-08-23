---
id: 34-upstream-watch
title: Upstream Watch
type: COMPONENT
path: Corpora / ffmpeg / Upstream Watch
source_files: [corpora/ffmpeg/upstream-watch.lock, packages/registry-tools/src/upstream-lock.ts, packages/registry-tools/src/upstream-watch.ts, .github/workflows/upstream-watch.yml]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-6
depends_on: [32-ffmpeg-corpus]
tags: [upstream-watch, lock-file, drift-detection, generalized-pattern, wrapper-over-tool-not-owned]
test_files: [packages/registry-tools/test/ffmpeg-upstream-watch.test.ts, packages/registry-tools/test/helpers/ffmpeg-upstream-probe.ts]
known_issues:
  - "[gap] Corpus Generator [17]'s `comprehendo diff` could not be reused as this doc's Architecture assumed. Its `computeDrift` diffs a corpus against `scanTarget`'s TypeScript exports and throw sites, and ffmpeg has argv and stderr instead, the same wall 32 hit with `verifyAgainstUpstream`. What was genuinely reused is everything downstream of the scan: the `{kind, subject, was?, now?}` drift record, the `target`/`scanned_version` report envelope, the never-writes rule, and the `drift.length > 0 ? 1 : 0` exit code. Two honest departures, both because the subject is a lock file rather than a corpus: `corpus_version` becomes `locked_version`, and there is no `stubs` list because nothing in a lock file can be a stub. A first-class `comprehendo diff --target cli` verb belongs to 17, not here."
  - "[gap] A flag entry proves the parser still ACCEPTS the name (no `Unrecognized option '<name>'`), never that its semantics are unchanged. A silent semantic change to a flag is caught only where a behavior entry locks the specific claim a fix or topic makes about it, which is why nine behaviors are locked beside the seventeen flags."
  - "[deferred] The lock's twelve stderr-pattern entries carry their inducing argv verbatim, duplicating 32's `WITNESSES` table, so the lock file is self-contained (a lock that points into a test helper is not a record of what was locked). The duplication is held by a test that compares them argv for argv and fixture for fixture, so a divergence goes red rather than silent."
  - "[deferred] `-hide_banner` is used by every inducing invocation but is NOT locked: no cataloged fingerprint, fix or topic depends on it, and the business rule is that the lock never grows past what the corpus actually depends on. Its disappearance would still surface, as pattern drift on all twelve stderr entries."
  - "[deferred] The lock is re-locked by editing it and re-running the check, not by a generator verb. The 38 entries were derived from the corpus and observed against the real binary once; there is no `comprehendo relock` because 17's scanner cannot produce one for a CLI target (see the first known issue), and a writer that regenerates what it verifies could not be run twice."
  - "[deferred] The workflow itself was never executed on GitHub, only parsed and run step by step locally (real `ffmpeg -version`, real `npm ci --prefix`, real `npx vitest run ffmpeg-upstream-watch` from a clean install, exit 0). Its first scheduled run is its first real one."
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

- [x] The lock file enumerates every flag, behavior, and stderr pattern
      the ffmpeg corpus's cataloged entries depend on. 38 entries, all
      derived from the corpus's own `declared_schema`, fixes and
      topics, none guessed: 17 flags (the 14 declared operations plus
      `-nostdin`, `-encoders`, `-filters`, the latter two because two
      runbook fixes tell the reader to run them), 9 behaviors (every
      claim a fix or topic makes about corrected behavior, locked at
      the value a real run produced), 12 stderr patterns (verbatim
      from `twins.json`, with 32's own inducing argvs, self-contained
      rather than pointing into a test helper).
- [x] A synthetic upstream change to a locked surface fails the watch
      job with the specific element named. Verified live, three
      mutations of the SHIPPED lock file, each run through the
      workflow's own command and reverted: a flag renamed to
      `-vsync2` -> `flag-changed -vsync2` naming the real
      `Unrecognized option 'vsync2'` error (4 tests red); a stderr
      pattern tightened to a wrong digit -> `pattern-unmatched` naming
      it, with the real current stderr shown alongside (7 red); a
      locked behavior value changed -> `behavior-changed
      scale-minus-two-derives-an-even-width / was: 721,720 / now:
      722,720` (4 red). CC4's real routing proved with the gate's own
      code: drift becomes a `TruthFailure`,
      `folkloreFindings`/`registryTruthFindings` report it at the
      traced twin, never a silent pass.
- [x] The watch job runs on a schedule or version-bump trigger, not
      only manually. A real `.github/workflows/upstream-watch.yml`
      (this repo genuinely hosts `corpora/ffmpeg/`, unlike Submission
      Gate [29]/Scoped Publisher [31]'s registry-repo boundary):
      `schedule` (weekly cron), `workflow_dispatch`, and `push`
      triggers. Parsed and verified step by step locally from a wiped
      install (real `ffmpeg -version`, real `npm ci --prefix`, real
      `npx vitest run ffmpeg-upstream-watch`, exit 0); never executed
      on a real GitHub runner yet, recorded honestly in Known Issues.

## Dependencies

- [32-ffmpeg-corpus](32-ffmpeg-corpus.md)

## Known Issues

- [gap] `comprehendo diff` [17] could not be reused as the Architecture
  section assumed: its scanner reads TypeScript exports and throw sites, and
  ffmpeg has neither. Its drift-record shape, report envelope, never-writes
  rule and exit code were reused; the scanner was replaced by a CLI probe.
- [gap] A locked flag proves the name still parses, never that its meaning is
  unchanged; the semantic half is covered only by the locked behaviors.
- [deferred] The lock carries 32's inducing argvs verbatim so it is
  self-contained, and a test holds the two copies equal.
- [deferred] `-hide_banner` is used by the inductions but is not locked: no
  cataloged entry depends on it.
- [deferred] Re-locking is a hand edit plus the check, not a generator verb.
- [deferred] The workflow was verified step by step locally, never on a real
  GitHub runner.

## Fixed Issues

### The lock file was stale against 32's own review-driven fingerprint fix (fixed 2026-08-22)

This build started before 32's independent review found and fixed
two real fingerprint-precision defects (see 32-ffmpeg-corpus.md
Fixed Issues), so the lock file's `FFMPEG_ODD_DIMENSION` entry
carried the pre-fix pattern (`*width not divisible by 2 (*)*`)
against a corpus whose `twins.json` had already moved to the widened
`* not divisible by 2 (*)*`. The mismatch surfaced immediately at
merge as 4 real test failures (the lock's own "enumerates what the
corpus depends on" and "re-probes each cataloged failure" tests), not
silently.

- Fixed by updating the lock entry's `stderrPattern` to match the
  current corpus. Verified: 23/23 in `ffmpeg-upstream-watch.test.ts`,
  328/328 across `packages/registry-tools`.

### `packages/registry-tools`'s 5s default test timeout was tight for real subprocess work (fixed 2026-08-22)

Found while merging: `gate-folklore.test.ts`'s "reports the same
defect the same way whichever tier carries it" (26/29's file, not
this feature's) ran 5.24s under load, over vitest's 5s default. This
is not one test's problem: the whole package now spawns real
subprocesses throughout (npm pack, npm install --offline, the real
ffmpeg binary), by design, so a tight default is latently flaky
package-wide, not a defect in any one test.

- Fixed by setting `testTimeout: 20_000` in `vitest.config.ts`
  (orchestrator-level, package-wide, not owned by any single
  feature). Verified: 328/328 green.
