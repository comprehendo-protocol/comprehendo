---
id: 15-manifest-wiring
title: Manifest Wiring
type: COMPONENT
path: Core / Manifest Wiring
source_files: [packages/core/src/config.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [14-sdk-entry]
tags: [manifest, package-json, pyproject-toml, static-discovery, provider-declaration]
test_files: []
known_issues: []
---

# Manifest Wiring

## What to Build

Writes and reads the provider-side manifest declaration: the `comprehendo`
key in `package.json` (`{version, level}`) and `[tool.comprehendo]` in
`pyproject.toml` for the Python port. This is the static-discovery channel
(an agent, or a tool, can learn a package speaks Comprehendo without
importing it, just by reading the manifest). Must-not: the manifest never
carries a field that could suppress or veto a registry corpus (CC8 [19]
scans for exactly this absence).

## Architecture

`packages/core/src/config.ts` (provider-side half; the consumer-side four
knobs live on Config Loader [23] in Wave 4). Consumed by SDK Entry [14]
(stamps the manifest for a package built with `makeProvider`) and probed
by Router & Precedence [22] to detect native adoption independent of
runtime marker probing.

## Implementation Notes

- Static discovery complements runtime discovery: the marker (Marker &
  Probe [11]) is the runtime truth, the manifest is the pre-import truth.
  When they disagree, the marker wins (the disagreement fixture,
  Conformance Fixtures [04]).
- The provider-side manifest is deliberately minimal (`{version, level}`)
  precisely because CC8 [19] requires that no provider-side mechanism can
  suppress a registry corpus; keeping the schema small keeps that
  guarantee easy to scan for.

## Data Model

`{ comprehendo: { version: string, level: 1 | 2 } }` in `package.json`.
`[tool.comprehendo]` with the same two fields in `pyproject.toml`.

## API/Interface

N/A as a consumer-callable surface; this is a static declaration read by
tooling, not a runtime function.

## Business Rules

- The manifest schema contains exactly `version` and `level`, nothing
  that could veto or suppress a registry corpus.
- When the manifest and the runtime marker disagree, the marker is
  authoritative (never the manifest).

## Acceptance Criteria

- [ ] `makeProvider`-built packages stamp `package.json`'s `comprehendo`
      key with the correct `{version, level}`.
- [ ] A CC8 [19] scan of the manifest schema finds no suppression field.
- [ ] The disagreement fixture (Conformance Fixtures [04]) resolves in
      the marker's favor when read through this component.

## Dependencies

- [14-sdk-entry](14-sdk-entry.md)

## Known Issues

None recorded at plan time.
