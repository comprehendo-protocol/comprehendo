---
id: 04-conformance-fixtures
title: Conformance Fixtures
type: COMPONENT
path: Spec / Conformance Fixtures
source_files: [packages/spec/kit/fixtures/]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-1
depends_on: [01-cc2-shape-identity, 03-shape-schemas]
tags: [conformance-kit, fixture, probe-transcript, did-you-mean, forward-compat, disagreement-fixture]
test_files: []
known_issues: []
---

# Conformance Fixtures

## What to Build

The language-neutral fixture set that both implementations run and both
CI matrices consume unmodified: probe transcripts (hit, miss, mid-failure
discovery), twin round-trips, three-vocabulary docs lookups, did-you-mean
transcripts, the UNDOCUMENTED source-pass fixture, the forward-compat
fixture, and the disagreement fixture. Must-not: no fixture is
implementation-specific; a fixture that only makes sense in one language
is not a conformance fixture.

## Architecture

Lives in `packages/spec/kit/fixtures/`, validated against the Shape
Schemas [03]. Doubles as the golden example set for docs and for
`COMPREHENDO.md`: tests, docs, and agent context are one artifact, not
three separately maintained ones.

## Implementation Notes

- **Forward-compat fixture**: a twin carrying unknown fields must be
  accepted by every implementation, because fields are only ever added
  within a major (RFC §11). This is the fixture that would catch an
  implementation that rejects on unknown keys.
- **Disagreement fixture**: manifest says one thing, marker says another;
  the marker wins. This exercises the precedence rule at the shape level,
  ahead of the router's own precedence logic (Router & Precedence [22]),
  because a manifest can drift from what the code actually does at
  runtime and the marker is closer to the truth.
- **Probe transcripts**: hit (a real corpus answers), miss (UNDOCUMENTED
  with did-you-mean), and mid-failure discovery (an agent that never
  probed learns the fluent path exists because the caught twin
  self-identifies).

## Data Model

Fixture files are JSON, one fixture set per scenario, validated against
the schemas in Shape Schemas [03]. No fixture format is invented here
beyond what the schemas already define; a fixture is an instance of a
shape, not a new shape.

## API/Interface

N/A (fixtures are test data, not runtime exports).

## Business Rules

- A fixture change is a breaking change and is rejected outside the
  deliberate "spec bug, fix the spec first" path (CC2 [01]).
- Every fixture round-trips through both implementations' serializers with
  byte-identical output.
- The negative-kit counterpart to each rule lives in Negative Fixtures
  [05], never mixed into this positive set.

## Acceptance Criteria

- [ ] Probe-transcript fixtures cover hit, miss, and mid-failure-discovery
      scenarios.
- [ ] The forward-compat fixture is accepted (not rejected) by every
      implementation under test.
- [ ] The disagreement fixture proves the marker wins over a
      contradicting manifest declaration.
- [ ] The UNDOCUMENTED source-pass fixture proves the explicit,
      permitted one-question source read that CC10 [20] allows.
- [ ] Three-vocabulary docs-lookup fixtures exist (tool's own terms, a
      known-tool equivalent, and task language).

## Dependencies

- [01-cc2-shape-identity](01-cc2-shape-identity.md)
- [03-shape-schemas](03-shape-schemas.md)

## Known Issues

None recorded at plan time.
