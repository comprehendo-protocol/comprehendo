# Wave job manifest: comprehendo-wave-4

mode: unattended
branch: wave/comprehendo-wave-4
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 2): 19-cc8-native-precedence, 20-cc10-honest-miss [done, SPECs, no code]
- batch 2 (sequential, 1): 21-fingerprint-index-matcher (dep 20; new package packages/registry-tools)
- batch 3 (sequential, 1): 22-router-precedence (dep 19, 21, 12; new file packages/core/src/router.ts)
- batch 4 (parallel, 2): 23-config-loader (dep 22; EXTENDS the existing packages/core/src/config.ts from 15-manifest-wiring), 24-wrap-proxy (dep 22, 12; new file packages/core/src/wrap.ts)

## Features

- [x] 19-cc8-native-precedence (SPEC)
- [x] 20-cc10-honest-miss (SPEC)
- [x] 21-fingerprint-index-matcher (COMPONENT), 39/39 green, merged; scaffolded packages/registry-tools
- [ ] 22-router-precedence (COMPONENT)
- [ ] 23-config-loader (COMPONENT)
- [ ] 24-wrap-proxy (COMPONENT)

## Judgment log

(SPECs 19-20 had no code phase, mechanical contract confirmation, no judgment calls worth logging beyond what's in their docs.)

### 21-fingerprint-index-matcher (11 calls, unattended, no blockers)

1. Split into a second file (`fingerprint-facets.ts`) at the 300-line
   size gate, same construction-path/pure-checks split as `twin.ts`/
   `twin-validate.ts`; source_files corrected accordingly.
2. UNSTRUCTURED literals (`SPEC_VERSION`, `UNSTRUCTURED_CODE`,
   `UNSTRUCTURED_REASON`) duplicated from core rather than imported:
   `registry-tools` and `core` install independently (no workspace
   wiring, a cross-package `src/` import would break `rootDir`), so
   the duplicate is held by a drift test reading core's real source
   and the kit's `twin.schema.json` directly.
3. Candidates ride in the spec-owned `accepts` field (`package#corpusEntryId`
   strings), absent (not empty) when nothing was close; richer
   per-facet detail lives on `MatchResult`, outside the twin.
4. Message patterns are literal text plus `*` as the only metacharacter
   (never a RegExp built from corpus input, the project's own rule),
   anchored both ends, linear indexOf matching, one canonical form.
5. An unobservable facet (declared `stackShape` but no stack in the raw
   value, etc) counts as REJECTED, not skipped: precision-first, a
   facet that can't be confirmed hasn't been confirmed.
6. Two-or-more full matches is ambiguity with NO tie-breaking or
   specificity ranking at all: "no heuristic drift" is only true if
   there's no ranking function to drift.
7. A within-package duplicate fingerprint also fails the build (same
   defect as cross-package, tagged `crossPackage: false`); an entry
   declared twice with identical id+facets is deduped, not a collision.
8. An entry with no facet at all is refused at construction (would
   match everything or nothing depending on how it's read); validation
   runs on `unknown` so the same function guards hand-written and
   loaded-from-disk corpora.
9. `kind` (optional, `runtime-error` default) keeps the static-pattern
   question open per Wave-1: static-pattern entries index and collide
   -check under their own kind but are skipped by the runtime matcher,
   so they can never make a caught error ambiguous.
10. Property generator hand-rolled and SEEDED (mulberry32 PRNG, 5
    mutation kinds, ~600 mutations, every case reproduces by its
    printed seed), with vacuity guards so a silently-stopped generator
    fails instead of passing green. Verified with teeth: patching the
    matcher to guess instead of degrade turned 16 tests red.
11. Serialization (`serializeIndex`/`parseFingerprintIndex`) is in
    scope here (the doc calls the index "compiled into a single static
    artifact"): stable key order, sorted entries, byte-identical for
    the same input in any order; `parse` re-runs `build`'s own
    refusals so a hand-edited artifact can't smuggle a defective entry
    past the gate.
