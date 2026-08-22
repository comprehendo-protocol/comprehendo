---
id: 16-recorder
title: Recorder
type: COMPONENT
path: Core / Recorder
source_files: [packages/core/src/recorder.ts]
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-2
depends_on: [14-sdk-entry]
tags: [recorder, black-box, local-log, maintainer-tool, opt-in]
test_files: []
known_issues: []
---

# Recorder

## What to Build

An optional maintainer black box: records every call through a provider
built with `makeProvider`, both directions, with timestamps, to a local
file only. Opt-in, never enabled by default. Must-not: never transmit a
recording anywhere; this is not telemetry (CC6 [27]), it is a local
debugging aid the maintainer chooses to turn on for their own package.

## Architecture

`packages/core/src/recorder.ts`. An optional wrapper around the object
returned by SDK Entry [14]; when enabled, every call and response passes
through it before reaching the caller.

## Implementation Notes

- "Both directions" means the call in AND the response out, so a
  maintainer replaying a recorded session sees exactly what the agent saw.
- This is explicitly separate from the Docs Engine [13] miss log: the
  recorder covers the whole provider surface (twins, validate, explain),
  not just docs lookups.

## Data Model

Record: `{ timestamp, direction: 'in' | 'out', surface: 'twin' | 'docs' |
'validate' | 'explain', payload }`, appended to a local file.

## API/Interface

N/A as a consumer-facing primitive; this is a maintainer-side opt-in
wrapper, not part of the agent-facing surface.

## Business Rules

- Off by default; a maintainer must explicitly enable it.
- Writes only to a local file; a CC6 [27] scan of this module finds no
  network code.
- Never included in a package's default runtime path when disabled (zero
  overhead when off).

## Acceptance Criteria

- [ ] Recording is opt-in and off by default.
- [ ] Every call and response through a wrapped provider is captured with
      a timestamp.
- [ ] A CC6 [27] network scan of this module passes (no network imports).

## Dependencies

- [14-sdk-entry](14-sdk-entry.md)

## Known Issues

None recorded at plan time.
