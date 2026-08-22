---
id: 18-python-core
title: Python Core
type: COMPONENT
path: Python / Python Core
source_files: [packages/python/comprehendo/]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-3
depends_on: [01-cc2-shape-identity, 03-shape-schemas, 04-conformance-fixtures, 11-marker-probe, 12-twin-builder, 13-docs-engine, 14-sdk-entry, 15-manifest-wiring]
tags: [python-port, dunder-marker, typing-protocol, typed-dict, byte-identical, zero-fixture-change]
test_files: []
known_issues: []
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

- [ ] The full conformance kit passes with zero fixture changes.
- [ ] A twin serialized from Python is byte-identical to its Node
      fixture.
- [ ] `hasattr(exc, "__comprehendo__")` works as the one-line probe in a
      REPL demo.
- [ ] Zero runtime dependencies (scanned in CI, same discipline as the
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

None recorded at plan time.

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
