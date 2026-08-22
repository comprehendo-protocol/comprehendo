---
id: 23-config-loader
title: Config Loader
type: COMPONENT
path: Core / Config Loader
source_files: [packages/core/src/config.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: [22-router-precedence]
tags: [config-knob, prefer, pin, disable, require, local, consumer-side]
test_files: []
known_issues: []
---

# Config Loader

## What to Build

The consumer-side config loader: reads the five knobs (`prefer`, `pin`,
`disable`, `require`, `local`) from the consuming project's own manifest
and feeds them into Router & Precedence [22]'s routing decision. These
knobs belong to the consuming project, never to a provider (CC8 [19]).
Must-not: a provider manifest field can never express any of these five
knobs on the consumer's behalf.

## Architecture

`packages/core/src/config.ts` (consumer-side half; the provider-side
manifest declaration is Manifest Wiring [15]). Read once by Router &
Precedence [22] to compute routing per package per call.

## Implementation Notes

- `prefer`: reverses native-vs-sidecar precedence per package.
- `pin`: locks a package to a specific corpus version/source.
- `disable`: turns off Comprehendo routing for a specific package.
- `require`: demands a trust level for a package's corpus (e.g.
  `"require": { "<pkg>": "endorsed" }`, wired to Owner Endorsement [30]
  in Wave 5).
- `local`: mounts a private corpus for an internal package, the same
  mechanism Corpus Generator [17] serves for internal-only packages.
- Each knob is demonstrated changing routing independently in the Wave 4
  demo-state; none is theoretical.

## Data Model

Consumer config shape: `{ prefer?: string[], pin?: Record<string,string>,
disable?: string[], require?: Record<string,'community'|'endorsed'|'native'>,
local?: Record<string,string> }`, read from the consumer's own manifest.

## API/Interface

N/A as a directly-called primitive; this is configuration read at load
time and consumed internally by Router & Precedence [22].

## Business Rules

- All five knobs are consumer-side only; no provider mechanism can set or
  override them.
- `require` values map to the trust ladder: community, endorsed, native
  (Owner Endorsement [30], Wave 5).
- `local` corpora are private to the consuming project, never published
  to the public registry.

## Acceptance Criteria

- [ ] Each of the five knobs demonstrably changes routing behavior in
      isolation (kit fixtures, one per knob).
- [ ] `local` successfully mounts a private corpus for an internal
      package.
- [ ] A provider manifest cannot express any of these five knobs (CC8
      [19] scan).

## Dependencies

- [22-router-precedence](22-router-precedence.md)

## Known Issues

None recorded at plan time.
