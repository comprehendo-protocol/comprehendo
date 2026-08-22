# Wave job manifest: comprehendo-wave-2

mode: unattended
branch: wave/comprehendo-wave-2
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 4): 07-cc1-probe-purity, 08-cc3-no-raw-errors, 09-cc7-schema-bound-fixes, 10-cc9-marker-freeze [done, SPECs, no code]
- setup: packages/core (@comprehendo/core) scaffolded ahead of batch 2, TypeScript strict + Vitest, to avoid the shared-package.json collision batch 2's three builders would otherwise hit
- batch 2 (parallel, 3): 11-marker-probe, 12-twin-builder, 13-docs-engine
- batch 3 (parallel, 2): 14-sdk-entry (dep 11,12,13), 17-corpus-generator (dep 03,13 only, does not need 14, runs alongside it)
- batch 4 (parallel, 2): 15-manifest-wiring, 16-recorder (both dep 14 only, different files)

## Features

- [x] 07-cc1-probe-purity (SPEC)
- [x] 08-cc3-no-raw-errors (SPEC)
- [x] 09-cc7-schema-bound-fixes (SPEC), known_issues [gap] on apply grammar carried forward, 12-twin-builder must judge it
- [x] 10-cc9-marker-freeze (SPEC)
- [x] 11-marker-probe (COMPONENT), 58/58 green, merged, all 4 gates (typecheck/lint/test/build) clean; review found attachMarker() didn't validate its entry on write (a malformed attach silently became invisible to probe()/hasMarker()), fixed and mutation-verified, 100/100
- [x] 12-twin-builder (COMPONENT), 40/40 green, merged; resolved the apply-grammar gap to LITERAL against the wave-1 kit fixtures
- [ ] 13-docs-engine (COMPONENT)
- [ ] 14-sdk-entry (COMPONENT)
- [ ] 17-corpus-generator (COMPONENT)
- [ ] 15-manifest-wiring (COMPONENT)
- [ ] 16-recorder (COMPONENT)

## Judgment log

(SPECs 07-10 had no code phase, mechanical contract confirmation, no judgment calls worth logging beyond what's in their docs.)

### 11-marker-probe (13 calls, unattended, no blockers)

1. Export names (`COMPREHENDO_MARKER`, `attachMarker`, `probe`, `hasMarker`)
   chosen greppable and unambiguous; the doc names only the wire primitive.
2. `packages/core/src/index.ts` deliberately not touched, not in
   `source_files`, `sdk.ts` [14] is the doc's stated real public surface,
   and editing the barrel would touch a file 3 sibling lanes want.
3. Marker property descriptor is the strictest available: non-enumerable
   (a spread/Object.assign copy is a DIFFERENT object nothing marked),
   non-writable, non-configurable (identity claim, nothing downstream may
   replace or delete it).
4. Re-attaching a DIFFERENT entry throws `TypeError` naming the rule;
   re-attaching the SAME entry is an idempotent no-op (safe retry).
5. `probe` structurally validates the six `entry.schema.json` fields by
   type before returning (a type guard, not schema validation, no
   allocation, CC1-safe).
6. `probe` catches a hostile accessor (revoked Proxy, throwing getter) and
   answers "no marker" rather than propagating, since "probing never
   throws" is a literal business rule.
7. `attachMarker` freezes the entry it's given (a deliberate mutation AT
   attach time, not on the probe path CC1 governs), including freezing
   the `surfaces` array so a frozen claim can't have an editable body.
8. CC1 scan covers exactly the 5 modules the contract names (fs, net,
   http, dns, child_process); deliberately did NOT widen into `https`/
   `tls`/`worker_threads` (CC6's territory) or add a repo-wide "core
   imports nothing external" test (would go red inside a sibling lane's
   feature, not a violation of this one).
9. Red Gate: 45/58 red against the skeleton, 13 passed as documented
   rule-invariant/gate-falsifiability exemptions (same category as a
   generated conformance suite); 3 weak-assertion tests were strengthened
   (not deleted) and went properly red first.
10. "Allocates only the entry" proven via reference-identity across 10,000
    probes plus a Proxy trap census, not `--expose-gc` heap deltas (flaky,
    and the config enabling them isn't this feature's to edit).
11. 4 lint fixes touched test-file EXPRESSIONS only (no assertion
    weakened/removed), suite re-run red-to-green after to confirm the
    tests still bind.
12. Attaching to an already-frozen target is left to the runtime's own
    `TypeError`, not wrapped, since attachment happens before anything
    freezes the value in the documented flow.
13. Acceptance criterion 2 ("root export/error/handle all carry the
    marker") is demonstrated here across all 3 value shapes but owned end
    -to-end by SDK Entry [14], which wires a real provider through it.

### 12-twin-builder (10 calls, unattended, no blockers)

1. Apply grammar resolved to LITERAL against the wave-1 kit fixtures (see
   the doc's Fixed Issues; full rationale there).
2. A non-structured `apply` (e.g. a bare string) or one expressing no
   operation is its own violation kind (`unvalidatable-apply`,
   `empty-apply`), strictly narrower than "reject anything outside the
   declared operations", never wider, closing the exact command-channel
   gap a membership-only check would leave open.
3. Only TOP-LEVEL operator keys are checked (`{$match: {created_at:
   {$gte: ...}}}` contributes `$match`, not `$gte`), matching the spec's
   own `operatorsOf` helper; deeper checking would reject the positive
   kit itself.
4. Marker written as a local const with a comment, since marker.ts didn't
   exist on this branch yet; safe by construction (`Symbol.for` reads the
   global registry) and tested for identity. Orchestrator swapped it for
   the real import once both merged (separate commit above).
5. Marker VALUE on a thrown error defaults to `true` (presence only); a
   real `ComprehendoEntry` is an optional third arg for SDK Entry [14] to
   supply. Until [14] wires that through, `hasMarker()`/`probe()` (from
   11) will NOT recognize a twin-builder-thrown error, only a raw
   property read (`err[Symbol.for('comprehendo')]`) will. This is
   BY DESIGN per this call, not a bug; flagged for 14's build to close.
6. `TwinCatalogError` is a plain Error, deliberately not twinned: it's a
   build-time developer error (bad catalog) before any provider ships,
   twinning it would imply a published `code` vocabulary this shared
   builder doesn't own.
7. **The negative kit's `enforced: false` flags are now stale** for
   raw-error-leak and schema-escaping-fix (both gates now exist and both
   fixtures are proven against the REAL validator in `twin-kit.test.ts`).
   Flipping them means editing 3 files owned by 05-negative-fixtures
   (wave 1); not done by this builder, handed to the orchestrator.
   **Orchestrator: done in a separate commit below.**
8. Un-cataloged code in `twinFor()` -> UNSTRUCTURED (the ordinary novel
   -failure path); unknown code in `build()` (explicit "this IS
   cataloged") -> `TwinCatalogError`. Two call sites, two meanings,
   neither silently guessing.
9. Module split at 300 lines: `twin.ts` (223, construction path/public
   surface) and `twin-validate.ts` (267, the pure CC3/CC7 gate,
   re-exported wholesale). Checked no other doc claimed
   `twin-validate.ts` before creating it. Test files split the same way,
   the moved describes are byte-identical (sed-extracted, not retyped).
10. A cataloged twin built from a raw error with no catalog-authored
    `received` keeps the raw text in `received` anyway (CC3 forbids raw
    text as the PRIMARY message only, never says to drop it).

### Orchestrator: 12-twin-builder marker integration and negative-kit flip

Swapped twin.ts's local marker const for the real `./marker.js` import
once 11 merged (separate commit, all 4 gates re-verified: 100/100).
Flipped the negative kit's now-stale `enforced: false` flags for
raw-error-leak and schema-escaping-fix to `true` (both gates genuinely
exist and reject their fixture for real as of this wave): see the
dedicated commit for the 3 files touched
(packages/spec/kit/negative/{raw-error-leak,schema-escaping-fix}.json,
packages/spec/test/helpers/negative.mjs, packages/spec/test/negative-kit
.test.mjs), all in the wave-1 negative kit's territory, done here because
12 correctly declined to touch a sibling wave's files itself.
