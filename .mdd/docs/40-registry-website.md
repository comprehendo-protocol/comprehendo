---
id: 40-registry-website
title: Registry Website
type: COMPONENT
path: Distribution / Registry Website
source_files: []
status: planned
phase: idle
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [28-corpus-format, 29-submission-gate, 36-priming-snippet]
tags: [comprehendo-dev, registry-browser, most-wanted-list, read-only, no-submission-portal]
test_files: []
known_issues: []
satisfies_contracts:
  - from: 29-submission-gate
    function: verifyAgainstUpstream
    when: "before a corpus PR is marked publishable"
    status: pending
    verified_at: ""
---

# Registry Website

## What to Build

`comprehendo.dev`: browses the registry, serves the spec and the priming
snippet, and renders the most-wanted list (demand ranking for missing
corpora, sourced from explicit registry issues with reactions, never from
collected miss logs, because telemetry does not exist, CC6 [27]). Submits
nothing. Must-not: this is explicitly not a submission portal, the
submission channel is pull requests against `comprehendo-protocol/registry`
(Submission Gate [29]), never a web form; the site never collects or
transmits anything from its visitors.

## Architecture

A static (or server-rendered, read-only) site reading from the published
registry (Scoped Publisher [31] output and Corpus Format [28] packed
artifacts), the spec (`@comprehendo/spec`), and the Priming Snippet [36].
Hosted at comprehendo.dev (name held, see Registry Reservations [39]).

## Implementation Notes

- The most-wanted list is sourced from GitHub issue reactions on
  `comprehendo-protocol/registry`, not from any telemetry or miss-log
  aggregation; CC6 [27]'s no-telemetry guarantee extends to this site by
  construction (it has nothing to collect from visitors, only public
  GitHub data to read).
- "Submits nothing" is the load-bearing constraint distinguishing this
  from a submission portal: every corpus submission still goes through
  the PR channel (Submission Gate [29]), this site is read-only.

## Data Model

Rendered from: the published registry index (per-package, per-corpus
status: community/endorsed/native), the spec document, the priming
snippet text, and the most-wanted list (GitHub issue + reaction counts).

## API/Interface

N/A as a consumer-callable primitive; this is a human-facing website, not
an agent-facing surface.

## Business Rules

- Read-only: no form on the site accepts a corpus submission or any other
  write.
- The most-wanted list ranks by registry-issue reactions, never by
  collected query or miss-log data.
- The site never transmits visitor data anywhere (no analytics beyond
  what a static host provides by default, no telemetry).

## Acceptance Criteria

- [ ] The site renders the current registry contents (packages, corpus
      trust tier: community/endorsed/native).
- [ ] The site serves the spec document and the priming snippet.
- [ ] The most-wanted list renders from registry-issue reactions.
- [ ] No form or endpoint on the site accepts a corpus submission.

## Dependencies

- [28-corpus-format](28-corpus-format.md)
- [29-submission-gate](29-submission-gate.md)
- [36-priming-snippet](36-priming-snippet.md)

## Known Issues

None recorded at plan time.
