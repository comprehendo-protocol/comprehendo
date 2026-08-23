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
- [x] 34-upstream-watch (COMPONENT), 23/23 new tests green, merged; a real scheduled GitHub Actions workflow (this repo genuinely hosts corpora/ffmpeg/, unlike 29/31's registry-repo boundary); found the same test-timeout class of flakiness I later had to fix package-wide

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

### 34-upstream-watch (19 calls, unattended, no blockers)

Every value in `corpora/ffmpeg/upstream-watch.lock` was observed
against the really-installed `ffmpeg 4.4.2-0ubuntu0.22.04.1` (and
`ffprobe` for one entry); nothing remembered, nothing inferred from
docs.

**The scope tension resolved by trying it, honestly partial.**
`comprehendo diff` [17]'s SCANNER (`scanTarget`) reads TypeScript
exports/throw sites, ffmpeg has argv/stderr instead, the identical
wall 32 hit with `verifyAgainstUpstream`. What DID generalize and was
reused: the `{kind, subject, was?, now?}` drift record, the
`{target, scanned_version}` envelope, the never-writes rule, the
`drift.length > 0 ? 1 : 0` exit code, the `<noun>-<verb>` drift-kind
spelling. Two honest departures (`corpus_version` -> `locked_version`
since the lock IS the "was" side; no `stubs` list since nothing in a
lock file can be a stub) rather than a fake field to preserve a shape.

1. The check is a vitest suite plus a workflow, not a new CLI verb:
   a `comprehendo upstream-watch` verb would need to spawn a child
   process from `packages/core/src`, which CC6 forbids.
2. The pure half (`upstream-lock.ts` format, `upstream-watch.ts`
   comparison) imports only `node:fs`; the spawning half
   (`ffmpeg-upstream-probe.ts`) lives in the test tree, checked
   against `no-telemetry.test.ts` (src-only scope) before writing a
   line.
3. Two src files, not one: format (parse, refuse, name the element)
   and comparison (drift, report, exit code, gate bridge) are
   different responsibilities.
4. **The lock format knows nothing about ffmpeg**: `program`,
   `fixture`, `capture.read` are plain strings, the ffmpeg-specific
   vocabulary lives only in the tool-specific probe runner. This is
   the whole reason a future wrapped-tool corpus can reuse the two
   src files unchanged, the doc's own "not an ffmpeg-only mechanism"
   claim.
5. What "the corpus actually depends on" was DERIVED from four real
   sources (manifest.json's declared_schema operations, topic
   signatures/examples, fix apply option keys, twins.json's message
   patterns), never guessed: 38 entries (17 flags, 9 behaviors, 12
   stderr patterns).
6. `-hide_banner` deliberately NOT locked (every invocation carries
   it, but no fingerprint/fix/topic depends on it; its disappearance
   would still be caught as pattern drift on all 12 stderr entries).
   `-encoders`/`-filters` ARE locked despite being absent from
   `declared_schema`, because two runbook fixes tell the reader to
   run them, a real dependency in exactly the rule's sense.
7. Every `tracesTo` (four resolvable forms) is machine-checked
   against the real parsed corpus by a test; an unresolvable trace
   fails the suite.
8. The 12 stderr entries carry 32's argvs verbatim (self-contained,
   never pointing into a test helper), held equal to 32's own table
   by a test so a divergence goes red, not silent.
9. **A flag probe only proves the name still parses**
   (`Unrecognized option` absence), never that its semantics are
   unchanged; that's what the 9 locked behaviors are for, each
   locking a claim a fix or topic actually makes, at the value a
   real run really produced.
10. The `now` side of a drift report is the last three MEANINGFUL
    lines, not the first: ffmpeg opens with a banner/input dump, and
    the load-bearing line is near the end. Found by reading a real
    report whose first line was useless.
11. Business rule 3 (routes into CC4, never silent) proved with the
    gate's real code, not prose: `driftAsTruthFailures` produces
    `TruthFailure`s at the traced twin codes, handed to the REAL
    `folkloreFindings`/`registryTruthFindings`, which answer in CC4's
    own wording. An element no twin depends on still produces a
    named failure.
12. AC3 built, not deferred by analogy to 29/31: checked first, and
    unlike those two features, `.github/workflows/` and
    `corpora/ffmpeg/` both genuinely live in THIS repo, so no
    boundary applies. Weekly cron (off the hour on purpose) plus
    `workflow_dispatch` plus corpus-touching pushes; ffmpeg installed
    unpinned on purpose, since the job exists to meet whatever
    release the distribution ships.
13. Files this feature doesn't own left alone (32's README not
    touched); the feature doc's fact fields updated to ground truth,
    `status`/`phase` left for the orchestrator.
14. **A flaky full-suite run was chased, not reran away.** One run
    failed twice, passed on rerun; rather than accept that, the
    hypothesis (real-spawn tests too close to vitest's 5s default)
    was reproduced deliberately (timeout set back to 5s under 6 busy
    loops, same tests failed at 6-10s), then fixed with an explicit
    300s allowance on every test that spawns the real binary. The
    same reproduction surfaced a test this feature does NOT own
    (26/29's `gate-folklore.test.ts`, 5.24s) as latently flaky on any
    slower runner; reported rather than touched (see the
    orchestrator's own package-wide `testTimeout` fix, 34's doc Fixed
    Issues).

Mutation-verified (AC2), 3 mutations of the SHIPPED lock file, each
reverted: a flag renamed to `-vsync2` (4 red, real "Unrecognized
option" error named); a stderr pattern digit changed (7 red,
`pattern-unmatched` naming it with the real current stderr shown); a
locked behavior value changed (4 red, `behavior-changed ... was: ...
now: ...`). Same three failure shapes held permanently by synthetic
entries in the suite.
