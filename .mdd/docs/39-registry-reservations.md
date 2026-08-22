---
id: 39-registry-reservations
title: Package Name & Registry Reservations
type: task
path: Distribution / Registry Reservations
source_files: [index.js, index.d.ts, package.json, py/pyproject.toml, ruby/comprehendo.gemspec, ruby/lib/comprehendo.rb, dotnet/Comprehendo/Comprehendo.csproj, dotnet/Comprehendo/Class1.cs]
status: complete
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: []
tags: [name-reservation, npm, pypi, rubygems, nuget, package-stub, defensive-registration]
test_files: []
known_issues: []
---

# Package Name & Registry Reservations

## What to Build

Minimal placeholder packages that hold the `comprehendo` name on every
target registry ahead of the real implementation landing, the same
defensive-registration move any name-sensitive project makes early:
`comprehendo` on npm (this repo's root `index.js`/`index.d.ts`/`package.json`),
`comprehendo` on PyPI (`py/`), `comprehendo` on RubyGems (`ruby/`), a
NuGet stub (`dotnet/Comprehendo/`), plus the two non-package name holds:
the `comprehendo-protocol` GitHub org (holds the org namespace every
package repo, the registry, and CI live under) and the comprehendo.dev
domain (the eventual home of the Registry Website [40]). This is
explicitly OUTSIDE the wave 1-7 build chain: it is
administrative name-holding, not part of the protocol implementation,
tracked here only so the spec's "Names are held" notes have a doc to
point at.

## Architecture

Each stub is a minimal, standalone package in its own registry-native
layout (root for npm, `py/` for PyPI, `ruby/` for RubyGems, `dotnet/Comprehendo/`
for NuGet), independent of the `packages/*` monorepo workspace the real
implementation (Waves 1-7) will build.

## Implementation Notes

- This work already landed ad hoc, ahead of the formal wave build (see
  git history: "Add minimal Python package to reserve comprehendo on
  PyPI", "Add NuGet (.NET) and RubyGems stub packages", "Publish
  comprehendo gem to RubyGems", "Add RubyGems trusted-publishing release
  workflow", "Add NuGet trusted-publishing push job to release
  workflow"). Recorded here so it is visible in the doc set rather than
  only in commit history.
- When Wave 2 (npm `comprehendo`) and Wave 3 (PyPI `comprehendo`) ship
  the real implementation, these placeholder packages are replaced in
  place, not published as a second package name.
- crates.io (publish-to-hold) and comprehendo.org (defensive redirect)
  are named in the source spec as still outstanding; not yet actioned.

## Data Model

N/A (administrative reservations, no runtime data shape).

## API/Interface

N/A (placeholder packages expose no real API surface yet).

## Business Rules

- A reservation stub never claims functionality the real implementation
  has not yet built; it exists only to hold the name.
- When a wave's real package ships, it replaces the corresponding
  reservation stub at the same package name, never a second name.

## Acceptance Criteria

- [x] `comprehendo` held on npm (root `package.json`).
- [x] `comprehendo` held on PyPI (`py/pyproject.toml`, published
      `0.0.1`).
- [x] `comprehendo` held on RubyGems (`ruby/comprehendo.gemspec`,
      published, trusted-publishing workflow in place).
- [x] `comprehendo` stub held for NuGet (`dotnet/Comprehendo/`).
- [x] `comprehendo-protocol` GitHub org held (registry, CI, and package
      repos live under it).
- [x] comprehendo.dev domain held.
- [ ] `comprehendo` stub held for crates.io (publish-to-hold, not yet
      actioned).
- [ ] comprehendo.org registered as a defensive redirect (not yet
      actioned).

## Dependencies

None.

## Known Issues

- [deferred] crates.io publish-to-hold and the comprehendo.org defensive
  redirect are not yet actioned; no Rust binding is planned before the
  Wave 3 zero-fixture-change gate, so this is low urgency by the source
  spec's own sequencing.
