# Wave job manifest: comprehendo-wave-6

mode: unattended
branch: wave/comprehendo-wave-6
started: 2026-08-22

## Lane plan

- batch 1 (sequential, 1): 32-ffmpeg-corpus (dep 26, 28, both complete; new corpora/ffmpeg/ directory, corpus-authoring content work, the bulk of the wave)
- batch 2 (parallel, 2): 33-ffmpeg-fingerprints (dep 21, 32), 34-upstream-watch (dep 32)

## Features

- [x] 32-ffmpeg-corpus (COMPONENT), 37/37 new tests green, merged; 12 real induced entries (1 fence, 2 heals, 9 runbooks), all against a real ffmpeg 4.4.2 binary, none remembered
- [ ] 33-ffmpeg-fingerprints (COMPONENT)
- [ ] 34-upstream-watch (COMPONENT)

## Judgment log

### 32-ffmpeg-corpus (14 calls, unattended, no blockers)

Every stderr line in the induction record was produced by a real run
against `ffmpeg 4.4.2-0ubuntu0.22.04.1`, `--enable-libx264`,
`--enable-gpl`, in this environment, copied verbatim, never
remembered. 12 cataloged entries across 7 topics; 2 real, reproducible
failures investigated and dropped (an ogg-container copy whose stderr
names no codec/container, so a fingerprint would match an unrelated
family; `-t abc`, real but same shape/territory as
`FFMPEG_INVALID_FRAMERATE`) rather than padding the count.

Disposition, given testable definitions before assigning them (fence:
the failure class becomes unreachable for ANY input, proved over
several sources including one the uncorrected form already handled
identically; heal: the specific invocation resolves silently and
safely, proved AND the already-correct case verified unchanged; else
runbook): 1 fence (`FFMPEG_ODD_DIMENSION`, `-vf scale=-2:720`, proved
over 3 sources), 2 heals (`FFMPEG_MAP_MATCHES_NO_STREAM`'s `-map
0:a?`; `FFMPEG_FILTER_WITH_STREAMCOPY`'s `-c:v libx264`, each proved
on the already-correct case too), 9 runbooks. Fence considered
honestly for every entry and refused for 11: a true fence usually
needs a wrapper that owns the call surface, which this corpus does
not; `FFMPEG_ODD_DIMENSION` qualifies only because ffmpeg's own
option surface (`-2`) already makes the mistake arithmetically
unreachable.

1. Hand-authored in 28's authoring shape, not generated: 17's
   `init`/`scan` walks TypeScript exports/throw sites, ffmpeg has
   argv and stderr instead. Read by 28's real `parse`, judged by its
   real `validate`, compiled by its real `pack`, gated by 29's real
   `runSubmissionGate`, no double anywhere.
2. Real tests at the Red Gate (not placeholder skeletons), confirmed
   red before the corpus existed (0/37, `CorpusFormatError: ...
   carries no manifest.json`).
3. A missing ffmpeg FAILS the suite, never skips it: a self-skipping
   suite reports green having verified nothing, exactly the folklore
   CC4 exists to catch. Cost recorded: registry-tools' suite now
   needs a real ffmpeg on PATH (or `COMPREHENDO_FFMPEG`).
4. Tests live in `packages/registry-tools/test/`, new files only; CC6
   scan reads `src/` only (checked against the new
   `no-telemetry.test.ts` before writing a line), so the real
   `child_process` use in test helpers is not a violation.
5. **`verifyAgainstUpstream` NOT used, no fake `node_modules/ffmpeg`
   invented.** That function resolves an installed npm package and
   calls exported functions; ffmpeg has neither. A CLI-shaped
   inducer (`ffmpeg-corpus.ts`'s `induceAll`) produces the SAME
   `UpstreamVerification` value from real runs, handed to 29's REAL
   `folkloreFindings`/`registryTruthFindings` unchanged, no gate code
   modified or bypassed. Recorded as a real gate gap (a first-class
   CLI induction seam belongs to 25/29), not a corpus quirk.
6. The `apply` grammar on a command line: `{"-vf": "scale=-2:720"}`
   is literal call data shaped as the option surface; settled the
   one CLI-specific ambiguity a module surface never raises (a
   repeatable flag like `-map`: string operand = occurs once, array
   operand = exactly those occurrences in order, matching
   `gate-induce.ts`'s existing reading).
7. Operand text is unconstrained by CC7 (it checks operation names,
   never operands); safe only because the applier passes operands as
   argv elements and never shells out, contract written into the
   corpus's own README rather than left implied. Recorded as a
   format-level gap, not this corpus's.
8. Fingerprints declare `message_pattern` only, no `exception`: a
   declared-but-unconfirmable facet counts as REJECTED (21's own
   `judge` logic), so a CLI entry with an `exception` field would
   reject every real match. Asserted as a test, not left as a comment.
9. Fence/heal applies hard-code the cataloged operand (`720`) at
   `confidence: likely`, not `high`: static call data cannot
   reference the caller's own value; the general rule lives in the
   `scaling` topic the same fix points at. Recorded as a format gap.
10. Disposition (fence/heal/runbook) carried as a `Fence:`/`Heal:`/
    `Runbook:` title prefix, since the authoring format has no field
    for it (an extra JSON key would be silently dropped by
    `readFixes`); held by a test so a fix losing its prefix goes red.
11. Topic-header `kind`/`source` (TypeScript-symbol metadata) omitted
    entirely rather than fabricated, since neither means anything for
    a CLI target and 28's `parse` reads neither.
12. 12 entries across 7 topics, chosen for coverage of the territory
    an agent actually hits (inputs, outputs, options, codecs,
    filters, scaling, stream selection), every entry independently
    fingerprintable.
13. Three topics (filters 630, scaling 643, stream-selection 605
    tokens) rewritten to fit the real CC5 600-token topic budget
    (real tiktoken-class meter), prose tightened, no evidence-bearing
    content cut.
14. Nothing blocked: the one thing that could have (CC7 unable to
    express a CLI provider's call schema at all) does not hold,
    `declared_schema`/`validateApply` handle it and both core's and
    registry-tools' validators accept the result.

Mutation-verified, 3 mutations each reverted: loosening
`FFMPEG_ODD_DIMENSION`'s pattern to `*Error*` (4 red), the fence
apply reverted to the failing form (3 red), a 13th twin added with no
witness (3 red, and the real gate names it: `folklore at
ffmpeg/twins[12] (folklore-entry): the inducing run for
FFMPEG_REMEMBERED_BUT_NEVER_RUN never observed it`).
