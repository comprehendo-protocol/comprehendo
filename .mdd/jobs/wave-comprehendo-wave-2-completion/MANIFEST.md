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

- [ ] 15-manifest-wiring (COMPONENT), still building
- [x] 16-recorder (COMPONENT), 32/32 green, merged (315/315 combined)

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
