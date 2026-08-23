# Wave job manifest: comprehendo-wave-6

mode: unattended
branch: wave/comprehendo-wave-6
started: 2026-08-22

## Lane plan

- batch 1 (sequential, 1): 32-ffmpeg-corpus (dep 26, 28, both complete; new corpora/ffmpeg/ directory, corpus-authoring content work, the bulk of the wave)
- batch 2 (parallel, 2): 33-ffmpeg-fingerprints (dep 21, 32), 34-upstream-watch (dep 32)

## Features

- [x] 32-ffmpeg-corpus (COMPONENT), 37/37 new tests green, merged; 12 real induced entries (1 fence, 2 heals, 9 runbooks), all against a real ffmpeg 4.4.2 binary, none remembered
- [x] 33-ffmpeg-fingerprints (COMPONENT), 24/24 new tests green, merged; 2038-trial property test over the real corpus's real patterns and real stderr, zero wrong twins; closed 32's uncovered comprehend(stderr) gap
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

### 33-ffmpeg-fingerprints (14 calls, unattended, no blockers)

No new source (`corpora/ffmpeg/` untouched, all 12 patterns already
survive every property), so the Red Gate is discharged by mutation,
not placeholders: 3 mutations, each reverted. Loosening
`FFMPEG_UNKNOWN_ENCODER`'s pattern over-broad turned 9 of 24 new
tests red across all three suites; patching the matcher to GUESS
instead of degrade (the CC10 violation itself) turned 2 red; patching
it to stop throwing on a collision turned 2 red.

1. **The "never a DIFFERENT entry" property did NOT catch the
   guessing matcher** (the guess usually lands back on the entry the
   mutation started from); the oracle-agreement property (a confident
   answer always matches a naive re-derivation of 21's own Business
   Rules) is what has teeth against guessing. A suite carrying only
   the weaker property would have passed a matcher that violates CC10
   outright.
2. AC1 was not actually covered by 32 (index/twin-builder only, never
   crosses `comprehend(stderr)`'s own seam): checked before deciding,
   then built (`ffmpeg-comprehend-surface.test.ts`), not just
   referenced.
3. The corpus is mounted through Config Loader [23]'s real `local`
   knob, not a fabricated `node_modules/@comprehendo/ffmpeg` install:
   same refusal 32's judgment call 5 already made for a different
   seam.
4. The mutation target is the cataloged LINE, in situ inside its real
   blob (banner, stream mapping, the line that matters, its echo),
   never a synthetic string: a near-miss is "the fingerprinted line
   came out slightly different", which is what an agent holding a
   real failed invocation actually has. `catalogedLine` throws if two
   lines carry the cataloged fragment, so a mutation can't silently
   leave the pattern satisfied.
5. Seven CLI-specific mutation kinds, split on the seam a pattern
   draws: operand/path/number (what `*` deliberately does not pin),
   word/drop/char (what it does pin, `mutate.ts`'s own PRNG reused as
   one kind of seven), splice (welds two cataloged failures
   together). 2038 trials, 240 seeds/entry: operand 240/240 and path
   80/80 still route home, number 158/160, char 127/394, drop
   39/444, word 36/432, splice 26 home / 66 honestly elsewhere / 37
   ambiguous / 159 miss. Zero wrong twins.
6. `splice` is oracle-guarded, not held to the strict "never a
   different entry" law: a splice CAN honestly carry another entry's
   whole text, and answering with that entry's twin is correct, not
   wrong. The strict law is asserted only for the six local kinds,
   where it genuinely holds.
7. **A message-pattern-only fingerprint's honest MISS names no
   candidates at all**, a domain fact recorded in known_issues, not a
   bug: with one facet there's no partial evidence to name on a
   reject. Candidates ARE named in the AMBIGUOUS case, proved both
   real ways (66 real two-cataloged-failure blobs; a real overlapping
   -pattern corpus).
8. Collision (identical pattern) and overlap (different patterns, one
   real stderr satisfies both) are different shapes; only collision
   is a build-time lint finding, since neither pattern is wrong in an
   overlap and nothing at build time can name a culprit. Both proved
   with the real gate: collision fails and compiles no index,
   overlap passes clean and degrades honestly at match time.
9. The deliberate collision is planted in exactly ONE toy twin, not
   all of them: the first cut created an INTRA-package collision by
   accident, caught the gate for the wrong reason, and would have
   made the cross-package assertion pass vacuously.
10. The operand-degradation guard is `> 0` on purpose (2 of 480
    operand mutations legitimately degrade, hitting the one numeral
    the catalog pins): without it, "operands still route home" would
    be satisfiable by a generator that changed nothing load-bearing.
11. No shared helper edited (`authored-corpus.ts`'s `coreModule`
    stays `'docs' | 'twin'` only, outside this doc's `source_files`,
    with 34 building concurrently): ~8 lines duplicated to load
    core's router by file URL directly instead. Visible and cheaper
    than a shared-file edit.
12. Every fixture is real: the corpus through 28's real `parse`, the
    fingerprints through 29's real `fingerprintsOf`, the index
    through 21's real `buildFingerprintIndex`, colliding/overlapping
    corpora through 17's real `runInit`/`runScan`/`writeCorpus`,
    stderr from the really-installed binary this run. Only one
    hand-written literal in all three suites (an overlapping pattern
    standing for a corpus that doesn't exist yet).
13. `corpora/ffmpeg/` untouched: `git diff` against the wave branch
    for `corpora/` is empty, since all 12 patterns already survive
    every property this build ran.
14. `packages/python`'s suite cannot run in this environment (needs
    3.11+, this box's default is 3.10), pre-existing, zero Python
    files touched.
