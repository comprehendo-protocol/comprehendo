# Wave completion-fixup manifest: comprehendo-wave-2-completion

mode: unattended
branch: wave/comprehendo-wave-2-completion
started: 2026-08-22

Context: 15-manifest-wiring and 16-recorder were both planned as part of
comprehendo-wave-2's feature set (see .mdd/waves/comprehendo-wave-2.md's
Features table) but were accidentally skipped when that wave was built and
closed. Wave 2 was already merged to main and its wave doc marked complete
before the gap was caught. This branch, cut fresh from main (which already
carries all 7 of wave 2's other features), builds the two missing features
and, once merged, wave 2's own completion record gets a correction note
rather than a silent backfill.

## Features

- [x] 15-manifest-wiring (COMPONENT), 69/69 green, merged (384/384 combined); review found locateTable missed the [[tool.comprehendo]] array-of-tables spelling, fixed and mutation-verified, 386/386
- [x] 16-recorder (COMPONENT), 32/32 green, merged; review found nothing, clean pass

## Judgment log

### 16-recorder (10 calls, unattended, no blockers)

1. `packages/core/src/index.ts` deliberately NOT touched: not in
   source_files, 15-manifest-wiring building the same file's
   neighbourhood concurrently, AND the doc itself requires the recorder
   never load on the default runtime path ("N/A as a consumer-facing
   primitive... never included in a package's default runtime path when
   disabled") - a barrel re-export would load it on every `import`.
   Locked structurally: a test asserts `sdk.ts`'s transitive closure
   never contains `recorder.ts`.
2. Opt-in is an explicit `{enabled: true}` option, never an env var or
   an ambient "a sink was passed" inference - only the maintainer's own
   code can turn the black box on.
3. Zero overhead when off is IDENTITY, not a disabled branch:
   `recordProvider(p)` returns the SAME object reference when not
   enabled, so there is no per-call `if (enabled)` to execute at all.
4. Surfaces recorded map to the doc's `twin | docs | validate | explain`
   vocabulary: `twinFor`/`errorFor`/`raise` all record as `twin` (method
   name in the payload); the raw `twins` builder and `mark()` are NOT
   wrapped (would double-record what `twinFor` already delegates to, or
   isn't a protocol call at all).
5. Payload adds `method` beyond the doc's fixed 4 keys (otherwise a
   replay can't distinguish `twinFor` from `raise`, both recorded as
   `twin`); `thrown` not `returned` on the throwing direction, since
   `raise()` always ends that way.
6. Errors normalized to `{name, message, twin?}` before recording -
   `JSON.stringify(new Error(...))` is `{}`, so an unnormalized record
   would write the interesting part missing.
7. Log-write failures counted via `recordingOf(provider).stats()`,
   never thrown, never silent - same shape as 13's miss log, "suppression
   needs a counter."
8. One test line rewritten during Phase 6 (an unbound-method lint trip),
   strengthened not weakened: now asserts identity through an index
   accessor in a loop AND that each surface is a function.
9. `wrapSurfaces`/`twinSurfaces` extracted from `recordProvider` purely
   for the 50-line function gate; no behavior moved.
10. Default log path `.comprehendo/recording.log`, beside 13's
    `.comprehendo/docs-usage.log`, already covered by the repo's `*.log`
    gitignore.

Review: clean pass, no findings.

### 15-manifest-wiring (10 calls, unattended, no blockers)

1. Minimal hand-written TOML table reader/writer for `[tool.comprehendo]`
   (zero runtime deps is hard), not a general parser: reads/writes
   exactly the standard `[tool.comprehendo]` + flat `version`/`level`
   form, preserves everything else in the file byte-for-byte (edits the
   table's own lines, never re-serializes). Alternate TOML spellings
   (`[tool]` + inline table, dotted assignment) come back
   `{status: 'unreadable', reason}` rather than a false "absent", and
   the writer REFUSES them rather than appending a second table.
2. Reading is three-state (`absent`/`declared`/`unreadable`), not
   `T | undefined`: collapsing the last two would conflate "no claim"
   with "a claim I could not read", exactly the distinction static
   discovery needs. Writing stays strict: a declaration that wouldn't
   validate against `manifest.schema.json` throws.
3. Stamper is idempotent at the byte level: compares the on-disk
   declaration first, writes nothing when it already matches (an
   already-stamped package is never reformatted).
4. Stamper MERGES into the `comprehendo` key (sets `version`/`level`,
   preserves every other key, e.g. consumer knobs, endorsement fields),
   never replaces it. The reverse (provider-side READ) is asymmetric on
   purpose: projects exactly `MANIFEST_FIELDS`, so a provider stuffing
   `disable`/`suppress`/etc into their own manifest gets back a
   2-field declaration with no suppression reachable through any
   provider-side export (CC8's schema half).
5. `Discovery.surfaces` is ABSENT, never `[]`, on a manifest-only
   resolution: static discovery can't know which surfaces exist, `[]`
   would falsely claim none do.
6. CC8 scope: this feature proves the schema half only (scan over
   `manifest.schema.json` + the projection, same shape 11's CC1/CC9
   scans use); runtime precedence enforcement is Wave 4's [22]/[19].
7. File size: 400 lines (the project's stated ceiling, `config.ts` is
   this feature's only owned file, splitting off the TOML half would
   have added a second shared file mid-wave). Trimmed from 451 by
   tightening prose and removing one duplicated try/catch, not cutting
   behavior; suite green before and after.
8. 7 of 69 tests green at the Red Gate (static scans over Wave-1 schema
   data, the same generated-conformance-suite exemption 11's CC1/CC9
   scans get), verified non-vacuous by two targeted mutation rounds
   (8/12 and 9/12 cc8 tests went red each time), both reverted.
9. **Raised, not decided, for the orchestrator (left deferred, see
   doc known_issues):** `packages/core/src/index.ts` not touched (same
   lane-safety reason as 16); `comprehendo init`'s `manifest_hint` is
   exactly `stampManifestFile` but wiring it touches `src/cli/*`, not
   this feature's file, so the hint's shape is pinned by a test instead
   and left for whoever next touches the CLI.
10. Entry surfaces exercised live against the BUILT dist (not the test
    suite): a real package.json with a pre-existing consumer `disable`
    knob and a real pyproject.toml, both stamped, both read back, the
    re-stamp correctly writing nothing, marker-vs-manifest resolution
    printed for a drifted manifest.
