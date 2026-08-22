# Judgment log, 11-marker-probe

Decide-and-log calls made while building `packages/core/src/marker.ts`.
Anything blocking would have stopped the build instead; nothing did.

## 1. Export names: `COMPREHENDO_MARKER`, `attachMarker`, `probe`, `hasMarker`

The doc names only the wire-level primitive (`Symbol.for('comprehendo')`) and
"the attachment/probe helpers around it", never their identifiers. Chose
greppable, unambiguous names. `COMPREHENDO_MARKER` (not `MARKER`) so a reader
of `sdk.ts`, `twin.ts`, or `router.ts` sees what is imported without opening
this file. CC9 is unaffected: the constant is a binding, not a second literal.

## 2. `packages/core/src/index.ts` deliberately NOT touched

The barrel is not in this feature's `source_files`, and the doc says `sdk.ts`
(14) is the package's real public surface. Adding a re-export would also edit a
file three sibling wave-2 lanes will want. Left as `export {}`. The entry
surface is exercised against the built `dist/marker.js` instead, which is a
real module path of the built package.

## 3. The marker property is non-enumerable, non-writable, non-configurable

The doc requires only that the marker is present and deterministic. Chose the
strictest descriptor:
- non-writable + non-configurable: the marker is an identity claim; nothing
  downstream may quietly replace or delete it (the "cannot be overridden"
  invariant gets `Object.freeze` plus a locked descriptor, per the build rule).
- non-enumerable: a spread or `Object.assign` copy is a DIFFERENT object that
  no provider marked, so the claim must not ride along into it. Keeps the
  marker out of `Object.keys`, inspection output, and copy semantics; symbol
  keys are already invisible to `JSON.stringify`.

## 4. Re-attaching a different entry throws a `TypeError`

The doc's must-not is "never attached conditionally in a way that makes its
presence non-deterministic". Silently ignoring a second, different entry (or
silently replacing the first) is exactly that ambiguity. Re-attaching the SAME
entry is an idempotent no-op (safe retry); attaching a different one throws
with a message naming the rule. The locked descriptor would throw anyway, this
just makes the failure legible instead of `TypeError: Cannot redefine property`.

## 5. `probe` validates the carried value structurally before returning it

`probe` returns `ComprehendoEntry | undefined`, so it must not hand back
`true`, a string, or `null` just because something occupies the marker key.
It checks the six data fields of `entry.schema.json` by type only. This is a
type guard, NOT schema validation (normative validation belongs to Shape
Schemas [03]); it allocates nothing and reads only the entry it was already
holding, so CC1 is untouched.

## 6. `probe` catches, and answers "no marker", on a hostile accessor

The business rule is "probing never throws". A revoked Proxy, a throwing `get`
trap, or a booby-trapped getter on the marker key would otherwise throw out of
the probe, in the exact place the router probes arbitrary caught errors. A
value whose marker cannot be read does not speak the protocol, so `undefined`
is the honest answer, not a swallowed bug.

## 7. `attachMarker` freezes the entry it is given (a mutation, on purpose)

CC1's no-mutation rule is about the PROBE path. Attachment happens once, at
construction or throw time, and freezing there is what makes the frozen-claim
invariant true by construction instead of by convention. `Object.freeze`
returns the same object, so entry identity (and therefore probe repeatability)
is preserved. The `surfaces` array is frozen too, a frozen entry with a live
array is a frozen claim with an editable body.

## 8. CC1 scan covers exactly the five modules the contract names

`fs`, `net`, `http`, `dns`, `child_process`, plus their `node:` forms. Did not
add `https`, `tls`, or `worker_threads`: those are CC6's (no telemetry) scope,
and a scan that quietly widens its own contract is a scan nobody can reason
about. Separately asserted that `marker.ts` imports nothing at all, which is
CC1's "and any module it imports" clause satisfied at the root.

Deliberately did NOT add a repo-wide "core imports nothing external" test:
that is a real project constraint (zero runtime dependencies) but it is not
this feature's to enforce, and it would go red inside a sibling lane's feature
rather than in a violation of this one.

## 9. Red Gate: 45 of 58 tests red, 13 passing by exemption

Every test asserting FEATURE behavior was red against the skeleton. The 13 that
passed are the rule-invariant and gate-falsifiability checks the build flow
exempts from the Red Gate (same category as the generated conformance suite):
- CC1 static scan, 5 forbidden modules + "marker.ts imports nothing" + the
  meta-assertion that the scan found files at all. Vacuously true today; they
  exist to stay true. Cannot be made red without committing a violation.
- CC9 negative-kit checks: the fixture names CC9/computed-marker, the scan
  rejects the fixture's computed form and accepts its frozen form, and the
  runtime demonstration that both forms resolve to one symbol. These prove the
  GATE is falsifiable, which is the point of driving the negative fixture.
- The kit drift guard (the sample entry has the kit's six fields).

Three tests that had passed only because their assertions were weak were
STRENGTHENED, not deleted, and went red: the marker's `description`, the single
exported symbol's registry key, and the re-import identity.

## 10. Memory evidence for "allocates only the entry"

`--expose-gc` heap deltas are flaky and the config file that would enable them
is not this feature's to edit. Proved the claim two deterministic ways instead:
reference identity of the returned entry across 10,000 probes (nothing is
allocated per probe), and a Proxy trap census showing exactly 10,000 `get`
traps for the marker key and zero mutating traps.
