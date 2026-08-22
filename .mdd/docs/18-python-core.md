---
id: 18-python-core
title: Python Core
type: COMPONENT
path: Python / Python Core
source_files: [packages/python/comprehendo/]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-3
depends_on: [01-cc2-shape-identity, 03-shape-schemas, 04-conformance-fixtures, 11-marker-probe, 12-twin-builder, 13-docs-engine, 14-sdk-entry, 15-manifest-wiring]
tags: [python-port, dunder-marker, typing-protocol, typed-dict, byte-identical, zero-fixture-change]
test_files: [packages/python/tests/test_marker.py, packages/python/tests/test_marker_purity.py, packages/python/tests/test_marker_freeze.py, packages/python/tests/test_twin.py, packages/python/tests/test_twin_validate.py, packages/python/tests/test_twin_kit.py, packages/python/tests/test_docs.py, packages/python/tests/test_docs_miss_log.py, packages/python/tests/test_sdk.py, packages/python/tests/test_sdk_toy_package.py, packages/python/tests/test_config.py, packages/python/tests/test_config_cc8.py, packages/python/tests/test_conformance_kit.py, packages/python/tests/test_byte_identical.py, packages/python/tests/test_cross_language_parity.py, packages/python/tests/test_budget_cc5.py, packages/python/tests/test_jsonschema_mini.py, packages/python/tests/test_zero_runtime_deps.py]
known_issues:
  - {type: deferred, note: "py/ (the PyPI name-reservation stub) and packages/python/ both declare the name comprehendo. How they relate at publish time (the stub re-exporting from here, or being replaced by it) is a Wave 7 Distribution decision, the same deferral pattern as packages/core versus the root package.json in Wave 2. py/ was not touched."}
  - {type: deferred, note: "comprehend(raw) is not ported. Three of the four surfaces this doc's API section names exist in packages/core today; comprehend(raw) is the agent-side entry Router & Precedence [22] owns, which is Wave 4 and unbuilt in TypeScript, so there is no JS surface to mirror. Porting it would mean guessing the router's precedence rules."}
  - {type: gap, note: "The CC3 catalog-time raw-leak check is a substring test (reason contains received), so a cataloged entry whose received IS the token its reason must name trips it. The kit's own STAGE_UNKNOWN twin (received: \"$grup\") is that shape. Identical in packages/core/src/twin-validate.ts, so this is a shared heuristic, not a port divergence, and not a fixture bug: a provider producing that twin through its real raise site (received supplied as raise-site context, where it belongs) never trips it."}
  - {type: gap, note: "The docs did-you-mean ranking reproduces every kit transcript's nearest candidate SET but not two of their exact lists: a 1.0/1.0 tie returns in corpus-index order (transcript shows the other order), and a fuzzy match sitting exactly on the 0.5 floor adds one extra candidate. Proven identical to the TypeScript reference by RUNNING it (packages/python/tests/test_cross_language_parity.py), and nearest is unordered and open in undocumented.schema.json. Whether the ranking should be deterministic against the transcripts is a spec question for the kit's owner."}
  - {type: deferred, note: "The local miss-log timestamp is Python's datetime.isoformat() (2026-08-22T10:00:00+00:00) where the JS engine writes Date.toISOString() (...Z, milliseconds). The miss log is a local maintainer file, not one of CC2's wire shapes, and nothing reads it across languages."}
primitives:
  - name: "__comprehendo__"
    kind: probe
---

# Python Core

## What to Build

The identical three layers as the JavaScript core (marker, twin, docs,
SDK, manifest), same file layout, same conformance kit, in Python 3.11+
using `typing.Protocol` and `TypedDict` for the shapes, zero runtime
dependencies. `hasattr(exc, "__comprehendo__")` is the working one-line
probe. Must-not: no fixture changes to make the kit pass; a change request
from this port is a spec bug, not a port accommodation.

## Architecture

`packages/python/comprehendo/`, mirroring `packages/core/src/` layer for
layer: marker, twin, docs, sdk, manifest. Depends on `@comprehendo/spec`
for fixtures only, no code dependency (`python -> spec (fixtures only,
no code dependency)`).

## Implementation Notes

- Every shape from Shape Schemas [03] gets a `TypedDict` or `Protocol`
  counterpart with identical field names to the TypeScript shapes (CC2
  [01]): no `snake_case` translation, the wire shape is the wire shape.
- `__comprehendo__` is the Python marker idiom, the dunder equivalent of
  `Symbol.for('comprehendo')`; the probe is `hasattr(exc, "__comprehendo__")`,
  demonstrated as a working one-line REPL check.
- This is the Wave 3 exit gate and the precondition for any further
  ecosystem: no additional language binding begins before this port
  passes the kit with zero fixture changes.

## Data Model

Same as Shape Schemas [03] (twin, fix, topic, index, entry, UNDOCUMENTED,
UNVALIDATABLE, manifest keys, config knobs), expressed as `TypedDict`
/`Protocol` types with identical field names.

## API/Interface

- `__comprehendo__`: the marker attribute, probed via
  `hasattr(value, "__comprehendo__")`.
- Python equivalents of `comprehend(raw)`, `docs(query?)`,
  `validate(input)`, `explain(input)`, mirroring the JS surface.

## Business Rules

- Every fixture from Conformance Fixtures [04] and Negative Fixtures [05]
  runs unmodified against this port.
- A twin serialized from Python is byte-identical to its Node fixture
  after canonical serialization.
- `[tool.comprehendo]` in `pyproject.toml` mirrors the `comprehendo` key
  in `package.json` field for field.

## Acceptance Criteria

- [x] The full conformance kit passes with zero fixture changes.
      (`git diff` over `packages/spec` is empty; every positive and
      negative kit fixture read in place, unmodified.)
- [x] A twin serialized from Python is byte-identical to its Node
      fixture. Proven three ways: every fixture re-serialized by
      Python's `canonical()` equals its own file bytes; every twin
      built from a kit fixture serializes identically to the fixture;
      and the actual TypeScript modules are run cross-language (Node's
      native type-stripping, an ESM resolve hook mapping `.js` to
      `.ts`) to confirm byte-identical output on live input, not just
      on the fixtures.
- [x] `hasattr(exc, "__comprehendo__")` works as the one-line probe in a
      REPL demo.
- [x] Zero runtime dependencies (scanned in CI, same discipline as the
      JS core).

## Dependencies

- [01-cc2-shape-identity](01-cc2-shape-identity.md)
- [03-shape-schemas](03-shape-schemas.md)
- [04-conformance-fixtures](04-conformance-fixtures.md)
- [11-marker-probe](11-marker-probe.md)
- [12-twin-builder](12-twin-builder.md)
- [13-docs-engine](13-docs-engine.md)
- [14-sdk-entry](14-sdk-entry.md)
- [15-manifest-wiring](15-manifest-wiring.md)

## Known Issues

- [deferred] `py/` (the PyPI name-reservation stub) and `packages/python/`
  both declare the name `comprehendo`. How they relate at publish time (the
  stub re-exporting from here, or being replaced by it) is a Wave 7
  Distribution decision, the same deferral pattern as `packages/core` versus
  the root `package.json` in Wave 2. `py/` was not touched by this build.
- [deferred] `comprehend(raw)` is not ported. Three of the four surfaces the
  API section above names exist in `packages/core` today; `comprehend(raw)` is
  the agent-side entry Router & Precedence [22] owns, which is Wave 4 and
  unbuilt in TypeScript, so there is no JS surface to mirror.
- [gap] The CC3 [08] catalog-time raw-leak check is a substring test (`reason`
  contains `received`), so a cataloged entry whose `received` IS the token its
  `reason` must name trips it. The kit's own `STAGE_UNKNOWN` twin
  (`received: "$grup"`) is exactly that shape. Identical in
  `packages/core/src/twin-validate.ts`: a shared heuristic, not a port
  divergence, and not a fixture bug, since a provider producing that twin
  through its real raise site (with `received` supplied as raise-site context,
  where it belongs) never trips it.
- [gap] The docs did-you-mean ranking reproduces every kit transcript's
  `nearest` candidate SET but not two of their exact lists: a 1.0/1.0 tie comes
  back in corpus-index order where the transcript shows the other order, and a
  fuzzy match sitting exactly on the 0.5 floor adds one extra candidate.
  Proven identical to the TypeScript reference by RUNNING it
  (`packages/python/tests/test_cross_language_parity.py` drives both), and
  `nearest` is unordered and open in `undocumented.schema.json`. Whether the
  ranking should be deterministic against the transcripts is a spec question
  for the kit's owner, not something a port may decide.
- [deferred] The local miss-log timestamp is Python's `datetime.isoformat()`
  where the JS engine writes `Date.toISOString()`. The miss log is a local
  maintainer file, not one of CC2's wire shapes, and nothing reads it across
  languages.

## Fixed Issues

### `packages/core`'s test fixture drifted from the kit transcript (fixed 2026-08-22)

Was: `packages/core/test/fixtures/mongodb-operator.packed.json`'s
`aggregation stages` topic was missing the second worked example the
kit's `probe-hit` transcript shows and ordered `see_also` differently,
found while this port's own copy of the same fixture was being built
and cross-checked against the kit.

- Fixed by matching core's copy to the kit transcript verbatim (Docs
  Engine [13]'s file, done as an orchestrator follow-up); it is now
  byte-identical to this port's own copy.

## Interface Overview

The Python port gives the same one-line discovery reflex Python
developers already know from `hasattr` checks: no import required to
probe, no shared dependency, just an attribute check on whatever you're
holding.

| Name | What it does |
|---|---|
| `__comprehendo__` | The dunder marker probed via `hasattr()` to discover Comprehendo support. |

### __comprehendo__

The Python marker idiom. If a value carries this attribute, it understands
the Comprehendo protocol, the same guarantee as the JavaScript
`Symbol.for('comprehendo')` marker.

```python
try:
    thing.do()
except Exception as exc:
    if hasattr(exc, "__comprehendo__"):
        print(exc.twin["fixes"][0]["title"])
```
