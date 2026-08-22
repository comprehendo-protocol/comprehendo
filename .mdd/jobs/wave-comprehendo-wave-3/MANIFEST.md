# Wave job manifest: comprehendo-wave-3

mode: unattended
branch: wave/comprehendo-wave-3
started: 2026-08-22

## Lane plan

- batch 1 (sequential, 1): 18-python-core (only feature in this wave)

## Features

- [x] 18-python-core (COMPONENT), 343/343 green, mypy --strict clean, merged;
  conformance kit passes with zero fixture changes; byte-identical
  serialization proven 3 ways including running the actual TS source
  cross-language; found+fixed a 13-docs-engine test fixture drift

## Judgment log

### 18-python-core (16 calls, unattended, no blockers)

1. Interpreter: `/usr/bin/python3.13`, not system `python3` (3.10), since
   the doc requires 3.11+; `requires-python = ">=3.11"` set without
   weakening it.
2. Wire FIELD names stay verbatim (already snake_case in the kit, no
   translation layer anywhere); provider-side AUTHORING structures
   (`ProviderCatalog`, hooks) use Python idiom naming, since CC2 only
   freezes wire shapes, not internal API surface.
3. Immutability via a hand-written `FrozenDict`/`FrozenList` (raises on
   mutation), not `MappingProxyType` (not JSON-serializable, would break
   the byte-identical proof) or a frozen dataclass (would rename wire
   fields into attributes).
4. Marker probe is a single `getattr` in a `try` (CC1: never throws even
   on a booby-trapped `__getattr__`); the twin, never the marker, is
   what serializes (Python attrs show in `vars()`, unlike a JS
   non-enumerable property, so nothing else may rely on marker-absence
   from serialization).
5. Packed-corpus test fixture: an independent copy under
   `packages/python/tests/fixtures/`, not a read of core's test fixture
   (would invert the declared `python -> spec (fixtures only)`
   dependency direction), with a drift guard comparing the two when
   core's copy is present.
6. JSON Schema validation via a hand-written mini-validator (exactly the
   keyword subset the 10 kit schemas use, unknown keyword raises rather
   than being silently ignored) instead of a `jsonschema` dependency,
   with its own anti-vacuity test suite proving it actually rejects bad
   input.
7. CC5 budget: Python payloads measured through the SAME Node budget
   harness via a real process boundary (`node kit/budget/run.js
   --scope ... --file ...`), not forked, not proxied.
8. `py/` (PyPI stub) left untouched; publish-time relationship to
   `packages/python/` deferred to Wave 7, same pattern as
   `packages/core` vs root `package.json`.
9. `[tool.comprehendo]` stamped in the port's OWN `pyproject.toml` as
   live entry-surface evidence for the manifest layer.
10. Red Gate: 270 red, 62 green (kit invariants, the mini-validator's own
    control, structural import/size scans, one negative marker-probe
    control), every one individually checked against the build flow's
    conformance-suite exemption, none waved through.
11. Block plan: `_frozen` -> marker -> twin -> docs -> sdk -> manifest ->
    conformance cross-check, each ending runnable with its own verify
    command and its own commit.
12. `comprehend(raw)` NOT ported: it's Router & Precedence [22]'s
    agent-side entry, Wave 4, unbuilt in TypeScript, no JS surface to
    mirror. Recorded `[deferred]`.
13. **CC3 catalog-time check is a substring test and the kit's own
    STAGE_UNKNOWN twin trips it** (`received: "$grup"` inside a
    `reason` that must name it). Identical behavior in
    `packages/core/src/twin-validate.ts`, a shared heuristic not a port
    bug: a twin built through its real raise site (received supplied as
    raise-site context) never trips it. Recorded `[gap]`.
14. **Two `nearest` lists the ranking doesn't reproduce exactly**,
    verified by literally RUNNING the TypeScript matcher cross-language
    (Node 24 type-stripping + an ESM resolve hook), not by reading it:
    both implementations return identical output on every query,
    including both divergent cases against the transcripts. `nearest`
    is unordered/open in the schema. Recorded `[gap]` as a spec question
    for the kit's owner.
15. **Found `packages/core`'s own packed test fixture drifts from the
    kit's probe-hit transcript** (missing an example, reordered
    see_also); corrected the Python port's own copy to the kit's
    verbatim body, reported (not touched, wrong feature's file)
    initially as `[gap]`. **Orchestrator: fixed core's copy directly,
    see the dedicated commit; the two are now byte-identical.**
16. Commit shape: test-first (red-gate suite) then source landing layer
    by layer, mirroring the house style from Wave 2; per-layer Green
    Gate iteration counts recorded explicitly since the git history
    alone wouldn't show them.
