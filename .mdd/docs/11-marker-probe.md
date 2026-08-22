---
id: 11-marker-probe
title: Marker & Probe
type: COMPONENT
path: Core / Marker & Probe
source_files: [packages/core/src/marker.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [07-cc1-probe-purity, 10-cc9-marker-freeze]
tags: [marker, symbol, probe, discovery, side-effect-free]
test_files: []
known_issues: []
primitives:
  - name: "Symbol.for('comprehendo')"
    kind: probe
---

# Marker & Probe

## What to Build

The frozen marker symbol and the attachment/probe helpers around it: a
symbol attached to a provider's root export, to every raised error, and to
controlled handles (a client, a cursor). Probing any of those checks for
the marker in one line, no I/O, no side effects, costing nothing until an
agent actually asks. Must-not: the marker is never computed at runtime,
never aliased under a second name, never attached conditionally in a way
that makes its presence non-deterministic.

## Architecture

`packages/core/src/marker.ts`. The single definition site for
`Symbol.for('comprehendo')` (CC9 [10]); every other module that needs the
marker imports it from here. Consumed by Twin Builder [12] (attaches the
marker to thrown twins), SDK Entry [14] (attaches it to the provider's
root export and controlled handles), and Router & Precedence [22]
(probes it to detect native adoption for precedence).

## Implementation Notes

- Discovery has four channels, and this component owns the first: the
  marker on the root export, every raised error, and controlled handles;
  the manifest declaration is static discovery (Manifest Wiring [15]);
  `COMPREHENDO.md` is file-browsing discovery (Wave 7); the twin's own
  `comprehendo` field is mid-failure discovery (Twin Builder [12]).
- The probe must satisfy CC1 [07] (zero I/O, zero mutation, allocates only
  the entry) and CC9 [10] (frozen literal, single definition site).

## Data Model

The probe returns a boolean (or the entry itself) for `value[Symbol.for('comprehendo')]`.
No other state.

## API/Interface

- `Symbol.for('comprehendo')`: the well-known symbol. Attach it to a
  provider's exports, thrown errors, and handles; probe by reading the
  property.

## Business Rules

- The symbol is defined once, imported everywhere else it is used or
  checked (CC9 [10]).
- Attachment happens at construction/throw time, never lazily computed on
  first access.
- Probing never throws, never performs I/O, and returns a stable result
  across repeated probes on the same value (CC1 [07]).

## Acceptance Criteria

- [ ] `Symbol.for('comprehendo')` is defined exactly once in
      `packages/core/src/marker.ts`.
- [ ] A provider's root export, every raised error, and named controlled
      handles all carry the marker.
- [ ] A 10,000-iteration probe test (CC1 [07]) passes with identical
      results and zero observable side effects.

## Dependencies

- [07-cc1-probe-purity](07-cc1-probe-purity.md)
- [10-cc9-marker-freeze](10-cc9-marker-freeze.md)

## Known Issues

None recorded at plan time.

## Interface Overview

The marker is how any code holding a value from a Comprehendo-speaking
package finds out, in one cheap check, that the value understands more
than its plain type suggests. It works the same way checking for
`Symbol.iterator` does: no lookup table, no network call, just a property
read on the thing you already have.

| Name | What it does |
|---|---|
| `Symbol.for('comprehendo')` | The well-known symbol probed on any value (export, error, handle) to discover Comprehendo support. |

### Symbol.for('comprehendo')

A global, frozen symbol. If a value carries it, that value (or the error
you just caught) understands the Comprehendo protocol: it can be twinned,
it can answer `docs()`, and its provider may support `validate`/`explain`.
Checking is one property read, costs nothing until you act on the result.

```js
const err = tryTheThing();
if (err[Symbol.for('comprehendo')]) {
  console.log(err.twin.fixes[0].title);
}
```
