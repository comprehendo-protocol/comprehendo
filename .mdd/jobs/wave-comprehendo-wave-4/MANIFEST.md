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
- [x] 21-fingerprint-index-matcher (COMPONENT), 39/39 green, merged; scaffolded packages/registry-tools; review found a same-id-different-facets silent drop, fixed and mutation-verified, 41/41
- [x] 22-router-precedence (COMPONENT), 57/57 green, merged (443/443 core combined); precedence flip proven live against real files, no reconfiguration; review found a silent-defect-swallow in nativeEvidence(), fixed and mutation-verified (444/444); review also found the "no node: import" claim doesn't hold transitively (config.ts/docs.ts pull in node:fs), left open as a gap since config.ts was under active concurrent development
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

### 22-router-precedence (11 calls, unattended, no blockers)

1. **Installed-corpus discovery, the load-bearing call: split at the
   I/O boundary, neither half faked.** `router.ts` is PURE (takes an
   `Environment` as data, imports no `node:` module, asserted by a
   source scan), `router-discovery.ts` is the REAL adapter (reads an
   actual `node_modules/@comprehendo/*` tree). Forced by the doc's own
   "side-effect free" rule, not invented for testability. The
   precedence flip is proven TWICE over against real files:
   `router-installed.test.ts` builds a real corpus package, comprehends
   a real caught error, then writes+imports+runs a real natively
   -adopted toy package and hands the error it really throws to the
   SAME router instance, which now answers native, with nothing
   reconfigured (the marker on the caught value is the authoritative
   channel, read per call, for free). The on-disk corpus-package shape
   (comprehendo.{packed,fingerprints,twins}.json) is this adapter's
   OWN provisional convention, `[deferred]` to 28/31 (Wave 5)'s
   authoritative format.
2. Core cannot import registry-tools (one-way dependency, `tsc`
   rejects the cross-package path with TS6059, verified live); 21's
   matcher arrives as a structural port (`CorpusMatcher`) that 21's
   real `FingerprintIndex` satisfies with zero adaptation. Tests load
   21's REAL module via a computed dynamic import, never a double.
3. `comprehend(raw)` returns a Twin (kit-shaped, matches the doc's own
   usage example); the `{package, source, reason}` decision record is
   a separate, pure `decideFor(pkg, raw?)` call. `RouterDecision`
   carries one additive field past the doc (`discovery`, from 15's
   `resolveDiscovery`).
4. "Native handles the call" means: return the twin the value already
   carries (`err.twin`), or `unstructuredTwin()` if none, NEVER fall
   back to the sidecar twin (would be a silent CC8 violation dressed
   as helpfulness).
5. `docs(pkg, query)` answers from the sidecar even for a native
   package (no handle to forward to; refusing would be a false
   UNDOCUMENTED, exactly the CC10 dishonesty forbidden); `decideFor`
   still correctly reports `source: 'native'`, so the narrowing is
   visible not implied.
6. `docs(pkg)` with no query returns the menu (mirrors 13's `docs(query?)`
   index-not-the-meal shape).
7. Only `prefer` implemented; `pin`/`disable`/`require`/`local` are
   23's (scope discipline, not omission, `RouterConfig` widens without
   reshaping this surface).
8. Twin builders/docs surfaces constructed EAGERLY at router creation
   (CC7's whole-catalog gate runs once, at construction; a corpus
   violating it fails router construction, same "exists whole or not
   at all" rule `makeProvider` follows), not lazily per call.
9. The "native toy, now installed" test fixture is a real ESM package
   in a real temp dir attaching `Symbol.for('comprehendo')` itself
   (can't import core's TS source outside vitest's transform); a test
   pins that symbol identical to core's `COMPREHENDO_MARKER` so the
   fixture can't quietly stop being real.
10. Package barrel (`index.ts`) not touched, same deferral pattern as
    15/16/17's CLI bin entry.
11. Two files (`router.ts` pure, `router-discovery.ts` adapter), split
    on the I/O boundary that also makes the no-node:-import scan
    possible; `source_files` corrected to three files total
    (router.ts, router-precedence.ts, router-discovery.ts).
