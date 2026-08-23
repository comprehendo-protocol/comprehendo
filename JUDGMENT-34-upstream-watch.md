# Judgment log: 34-upstream-watch (18 calls, unattended, no blockers)

Every value in `corpora/ffmpeg/upstream-watch.lock` was observed by running
the really-installed `ffmpeg version 4.4.2-0ubuntu0.22.04.1` (and, for one
entry, the really-installed `ffprobe`) in this environment. Nothing was
remembered, nothing was inferred from documentation. The generator that wrote
the file read the twin patterns out of `twins.json` and took the version
string from `ffmpeg -version`; every expectation it wrote was then re-verified
by the check itself, which is what "locked" means here.

## The scope tension, resolved by trying it

**Path 1, partially, and the part that does not hold is stated rather than
faked.** `comprehendo diff` [17] is built out of two halves. The SCANNER half
(`scanTarget`, `computeDrift`) reads a target package's TypeScript exports,
signatures and throw sites and diffs them against the corpus's topics and
twins. ffmpeg has none of those: it has an argument vector and stderr. This
is the identical wall 32 hit with CC11 [25]'s `verifyAgainstUpstream` and
recorded as a gate gap rather than papering over with a fake `node_modules`
entry, and the same answer applies, for the same reason.

What DID generalize, and is reused rather than reinvented:

| From `diff.ts` | In the watch |
|---|---|
| `DriftRecord {kind, subject, was?, now?}` | `WatchDriftRecord`, the same four fields, asserted by a test |
| `{target, scanned_version, ...}` envelope | kept verbatim |
| "it never writes" | the watch reports, never re-locks |
| `drift.length > 0 ? 1 : 0` | `watchExitCode`, the same rule |
| drift kinds spelled `<noun>-<verb>` | `flag-changed`, `behavior-changed`, `pattern-unmatched`, `element-unprobed` |

Two departures, both because the subject is a lock file and not a corpus, and
both refused a fake: `corpus_version` becomes `locked_version` (the lock is
the "was" side here), and there is no `stubs` list, because nothing in a lock
file can be a stub and a field faked to preserve a shape is worse than a shape
that says what it means.

## The calls

1. **The check is a vitest suite plus a workflow, not a new CLI verb.** Every
   gate in this project is a test (CC4's folklore gate, CC5's budget meter,
   CC6's telemetry scan). A new `comprehendo upstream-watch` verb would have to
   spawn a child process from `packages/core/src`, which CC6 [27] forbids, and
   would sit outside the one command CI already knows how to run.
2. **The pure half is in `src`, the spawning half is in the test tree.**
   `src/upstream-lock.ts` (format) and `src/upstream-watch.ts` (comparison)
   import nothing but `node:fs`; `test/helpers/ffmpeg-upstream-probe.ts` is
   the only file that spawns. Checked against `packages/core/test/no-telemetry.test.ts`
   before writing a line: that scan reads `packages/*/src` only, exactly as
   32 established for `ffmpeg-cli.ts`.
3. **Two src files, not one.** The lock FORMAT (parse, refuse, name the
   element) and the COMPARISON (drift, report, exit code, gate bridge) are
   different responsibilities and one file carrying both would be 500 lines.
   272 and 257 lines, both inside the size gate.
4. **The lock format knows nothing about ffmpeg.** `program`, `fixture` and
   `capture.read` are plain strings; the vocabulary (`ffmpeg`, `ffprobe`,
   `video-with-audio`, `dimensions`) belongs to the tool-specific probe runner,
   which refuses a name it does not know by name rather than reporting the
   element clean. That split is what the doc's "not an ffmpeg-only mechanism"
   costs, and it is the whole reason the next sidecar over an unowned tool can
   reuse the two src files unchanged.
5. **Key naming: the lock is camelCase, the report is snake_case.** Deliberate
   and slightly ugly. The lock file's keys are the doc's own data model
   (`lockedVersion`, `observedAt`), and the report's envelope is 17's
   (`scanned_version`). Renaming either to match the other would misquote one
   of the two contracts this feature answers to.
6. **`.lock` carries JSON.** The doc names the path
   `corpora/ffmpeg/upstream-watch.lock`, and the repo has zero runtime
   dependencies, so JSON is the only format that parses without one. Verified
   that the extra file does not disturb 28's `parse`: `corpus-source.ts` reads
   named files plus `topics/`, never an unfiltered directory listing, and the
   full 32 suite is still green with the lock file sitting beside the corpus.
7. **What "the corpus actually depends on" was derived, not guessed.** Four
   sources, all read out of `corpora/ffmpeg/`: the 14 operations in
   `manifest.json`'s `declared_schema` (an `apply` naming anything else is
   refused, so they are the call surface), the flags in each topic's
   `signatures` and worked examples, the option keys of the three executable
   fix `apply`s, and the 12 `message_pattern`s in `twins.json`. 38 entries:
   17 flags, 9 behaviors, 12 stderr patterns.
8. **`-hide_banner` deliberately NOT locked.** Every inducing invocation
   carries it, but no fingerprint, fix or topic depends on it, and the business
   rule is that the lock never grows past what the corpus depends on. Its
   disappearance would still be caught, as pattern drift on all twelve stderr
   entries. `-encoders` and `-filters` ARE locked despite being absent from the
   declared schema, because two runbook fixes tell the reader to run them
   ("read the encoder list of the binary in hand", "the filter list of this
   build"), which is a dependency in exactly the sense the rule means.
9. **Every trace is machine-checked.** `tracesTo` uses four resolvable forms,
   `twin:<CODE>`, `fix:<twinId>#<index>`, `topic:<name>`, `schema:<operation>`,
   and a test resolves every one of them against the real parsed corpus. An
   unresolvable trace fails the suite, so "traces to at least one cataloged
   fingerprint or fix" is enforced rather than asserted in prose.
10. **The twelve stderr entries carry 32's argvs verbatim, and a test holds
    the copies equal.** A lock file that pointed into a test helper for the
    invocation would not be a record of what was locked. The duplication is
    the framework-imposed kind that gets an equality test, argv for argv and
    fixture for fixture.
11. **A flag probe checks for the absence of `Unrecognized option '<name>'`,
    and that is all it can honestly claim.** Verified live in both directions
    before writing the check: all 17 locked flags parse clean, `-vcodex` and
    `-vsync2` produce the message. Recorded as a known issue that this proves
    the NAME survives, never the semantics; the semantic half is what the nine
    behavior entries are for.
12. **Behaviors lock the claim, not the run.** Each of the nine is a sentence
    a fix or a topic actually makes (`-2` derives an even width and keeps the
    requested height exactly; `0:a?` selects nothing when absent AND still
    selects the stream when present; `-y` overwrites while `-n` refuses and
    leaves the file at its old size; `ffprobe` names invalid data), and each is
    locked as the value the real run really produced (`722,720`, `100,50`,
    `video`, `video,audio`, `160,120`, `320,240`, `64,64`).
13. **The `now` side of a stderr drift record is the last three meaningful
    lines, not the first.** Found by reading a real report: ffmpeg opens with
    a banner and an input dump, and `width not divisible by 2 (721x720)` is
    third from the end. A drift report whose "now" line is
    `Input #0, lavfi, from 'testsrc=...'` teaches its reader to ignore it.
14. **Business rule 3 is satisfied with the gate's real code, not prose.**
    `driftAsTruthFailures` produces `TruthFailure` values at the twin codes the
    lock traces to, and `withWatchDrift` folds them into the
    `UpstreamVerification` 29 reads. Proved by handing the result to the REAL
    `folkloreFindings` and `registryTruthFindings`: the drifted twin comes back
    as `FFMPEG_ODD_DIMENSION is cataloged and no longer reproduces against the
    real package: drift`, which is CC4's own wording for exactly this path. An
    element no twin depends on still produces a named failure, so nothing is
    dropped for want of a twin to hang it on.
15. **AC3 was built, not deferred by analogy.** Checked first, as instructed:
    `.github/workflows/` exists in THIS repository and `corpora/ffmpeg/` is in
    it, so unlike Submission Gate [29] and Scoped Publisher [31] (whose CI
    lives in a registry repo that does not exist here) there is no boundary to
    draw. `upstream-watch.yml` runs weekly at 05:17 UTC Monday (off the hour on
    purpose), on `workflow_dispatch`, and on pushes that touch the corpus, the
    watch or the workflow itself. ffmpeg is installed unpinned, which is the
    point: the job exists to meet whatever release the distribution ships.
16. **One test was retargeted at the Red Gate.** "is the real binary" passed
    against the skeletons, because `requireFfmpeg` is 32's and already works.
    Retargeted to assert the REPORT carries the version it really scanned,
    which is this feature's claim; 23/23 red after that.
17. **One test assumption was corrected at the Green Gate, and it was the
    test that was wrong.** It asserted `finding.detail` and `finding.at`;
    29's `GateFinding` is `{check, corpus, locator, message}`. The
    implementation was routing correctly the whole time (confirmed with a
    throwaway probe before touching anything), so the fix went to the
    assertion, not to the code.
18. **Files this feature does not own were left alone.** `corpora/ffmpeg/README.md`
    is 32's and would be the natural place to mention the lock; it was not
    touched. The feature doc's `source_files`, `test_files` and `known_issues`
    WERE updated to the ground truth (the build landed two src modules, a
    workflow and two test files beyond the single path the doc predicted);
    `status` and `phase` were left untouched for the orchestrator's Phase 7.

## Mutation verification (AC2, teeth on the shipped artifact)

Three mutations of the REAL `corpora/ffmpeg/upstream-watch.lock`, each run
through the workflow's own command, each reverted:

1. A flag the binary does not carry (`-vf` entry re-locked as `-vsync2`):
   `flag-changed  -vsync2 / was: stderr NOT carrying Unrecognized option
   'vsync2' / now: ... Unrecognized option 'vsync2'. / Error splitting the
   argument list: Option not found`. 4 tests red.
2. A stderr pattern the binary no longer writes (`*width not divisible by 2
   (*)*` re-locked as `... by 4 ...`): `pattern-unmatched  *width not
   divisible by 4 (*)* / now: [libx264 @ ...] width not divisible by 2
   (721x720) / ...`. 7 tests red.
3. A behavior whose locked result is wrong (`722,720` re-locked as
   `721,720`): `behavior-changed  scale-minus-two-derives-an-even-width /
   was: 721,720 / now: 722,720`. 4 tests red.

The same three failure shapes are also held permanently by the suite, on
synthetic entries, so the teeth survive this session.

## Environment note, not a feature issue

`packages/python`'s pytest suite cannot run here: the default `python3` is
3.10 (the port needs `typing.NotRequired`, so 3.11+) and the 3.13 interpreter
on this box has no pytest. This diff touches no Python file. The three
JavaScript suites all ran: registry-tools 302/302 (279 before this feature),
core 548/548, spec 418/418 through its own `node --test` runner.

## Nothing blocked

The one thing that could have blocked was the Architecture line naming
`comprehendo diff` as the base. It turned out to be half true rather than
false, so the honest answer was to reuse the half that generalizes and record
the half that cannot, which is a known issue and not a contradiction between
docs.
