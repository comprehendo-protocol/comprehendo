# Judgment log, 12-twin-builder

Decide-and-log calls made during the build of `packages/core/src/twin.ts`.
Blocking calls are not here, they stop the build and get reported.

## 1. The `apply` grammar is LITERAL, not `template` (the doc's known_issues gap)

The doc and CC7 [09] both flag the grammar as an open Wave-1 question
(literal call data vs. a `template` form with placeholders bound from
fingerprint capture groups). Read against the kit, it is not open:

- `packages/spec/kit/fixtures/twin-round-trip.json` expresses every `apply`
  as literal call data shaped exactly like the provider's own call surface
  (a MongoDB aggregation pipeline, an array of stage objects). No fixture
  anywhere in either kit carries a `template` key or a placeholder.
- `packages/spec/kit/negative/schema-escaping-fix.json` declares
  `declared_schema.operations` and is caught by exactly one rule, spelled
  out in `packages/spec/test/negative-violations.test.mjs`: every top-level
  operator key used in `apply` must be a member of
  `declared_schema.operations`.

The kit is the acceptance criteria this component is judged against, so the
validator implements that same rule for real. `applyOperations()` is the one
place the grammar is encoded; a later Wave-1 ruling that adds a `template`
form extends that function and nothing else.

## 2. A non-structured `apply` is rejected, it is not "unknown grammar"

`apply: 'db.dropDatabase()'` has no top-level operator keys, so a
membership-only check would pass it. That is precisely the command channel
CC7 exists to close, so an `apply` that is neither an array of call objects
nor a call object is a violation (`unvalidatable-apply`), and an `apply`
that expresses no operation at all is one too (`empty-apply`). Both are
strictly narrower than "reject anything outside the declared operations",
never wider.

## 3. Only TOP-LEVEL operator keys are checked

`{ $match: { created_at: { $gte: ... } } }` contributes `$match`, not
`$gte`. Operand-level expressions are data inside a declared operation, and
this is the exact rule the spec's own `operatorsOf` helper encodes
(`negative-violations.test.mjs`). Deeper checking would reject the positive
kit, which is the definition of a wrong gate.

## 4. The marker is `Symbol.for('comprehendo')` written here, not imported

Marker & Probe [11] (`packages/core/src/marker.ts`) is building concurrently
in a sibling worktree and does not exist on this branch. CC9 [10] wants a
single definition site, so `twin.ts` carries `COMPREHENDO_MARKER` with a
comment naming [11] as the definition site to import from once it lands.
This is safe rather than merely expedient: `Symbol.for` reads the global
symbol registry, so both spellings resolve to the identical symbol value by
construction, and `twin.test.ts` asserts that identity
(`expect(COMPREHENDO_MARKER).toBe(Symbol.for('comprehendo'))`), which is the
"framework-imposed duplicate gets a test that both values match" discipline.
INTEGRATION POINT for the orchestrator: after [11] and [12] both merge,
replace the local const with `import { ... } from './marker.js'` and keep the
identity test.

## 5. The marker VALUE on a thrown error defaults to `true`

The probe entry shape (`entry.schema.json`) needs `name`, `level`,
`priming`, which belong to SDK Entry [14], not to this builder. So
`attachTwin(error, twin, probeValue = true)` guarantees presence and
truthiness only, and takes the real entry as an optional third argument so
[14] can attach it without this module inventing the shape. The marker
property is left `configurable`, so [11]/[14] can refine it; `err.twin`
itself is non-writable and non-configurable.

## 6. `TwinCatalogError` is a plain Error, deliberately not twinned

CC3 governs what a provider surfaces to an agent for a FAILED OPERATION.
`TwinCatalogError` is a build-time developer error raised when the provider's
own catalog does not conform, before any provider ships; twinning it would
imply a published `code` vocabulary for this shared builder, which the
versioning rule explicitly puts in the provider's hands, not here. It carries
`violations` structurally instead, and its message names rule, reason,
locator and the offending operation.

## 7. The negative kit's `enforced: false` flags are now stale, and I did not flip them

`packages/spec/kit/negative/{raw-error-leak,schema-escaping-fix}.json` both
carry `"enforced": false`, mirrored in
`packages/spec/test/helpers/negative.mjs` (`CONTRACTS`) and asserted by
`packages/spec/test/negative-kit.test.mjs` (`assert.deepEqual(enforced,
['oversized-topic'])`). With this component landed, both gates exist and
both fixtures are run through the real validator in
`packages/core/test/twin-kit.test.ts`. Flipping the flags means editing
three files owned by Negative Fixtures [05], which this feature does not
own, so it is NOT done here. Handed to the orchestrator as a follow-up.

## 8. Un-cataloged code routes to UNSTRUCTURED, unknown code to `build()` throws

`twinFor(code, raw)` with a code the catalog does not carry is the ordinary
novel-failure path, so it returns UNSTRUCTURED (CC3). `build(code)` is the
explicit "this IS cataloged" call, so an unknown code there is a provider
bug and raises `TwinCatalogError` with `unknown-code`. Two call sites, two
different meanings, neither silently guessing.

## 9. The module was split in two, so the doc's `source_files` is now short by one

The single-file implementation came to 451 lines against this project's
300-line gate (`.claude/hooks/quality-gate.sh`, hard-enforced at verify). The
skill's own answer applies literally here: the oversized bulk was the pure
functions, so they were extracted BECAUSE they are the testable part.

- `packages/core/src/twin.ts` (223 lines): the construction path, the shapes,
  and the public surface. Still the module everything imports.
- `packages/core/src/twin-validate.ts` (267 lines): the pure CC3/CC7 gate,
  re-exported wholesale by `twin.ts`, so no consumer import changed.

Checked before creating it: no other doc in `.mdd/docs/` claims
`packages/core/src/twin-validate.ts` (`grep '^source_files:' .mdd/docs/*.md`),
so no sibling lane can collide on it. FOR THE ORCHESTRATOR: this feature's
`source_files` should read
`[packages/core/src/twin.ts, packages/core/src/twin-validate.ts]`, and
`test_files` `[packages/core/test/twin.test.ts,
packages/core/test/twin-validate.test.ts,
packages/core/test/twin-kit.test.ts]`. Not written here, doc bookkeeping is
Phase 7's.

The test files were split the same way, and the two CC7 describes moved into
`test/twin-validate.test.ts` VERBATIM (assertions untouched, `sed`-extracted
after the Red Gate, not retyped); the shared provider catalog moved into
`test/helpers/catalog.ts` rather than being inlined twice.

## 10. A cataloged failure keeps the raw text too

CC3 only forbids raw text as the PRIMARY message. When a cataloged twin is
built with a raw error and the catalog authored no `received`, the raw text
is preserved in `received` rather than dropped, matching "the raw error is
never lost".
