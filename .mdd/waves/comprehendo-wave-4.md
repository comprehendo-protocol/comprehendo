---
id: comprehendo-wave-4
title: The Sidecar Router
initiative: comprehendo
initiative_version: 1
status: complete
depends_on: [comprehendo-wave-2]
demo_state: With @comprehendo/<toy> installed and the toy package NOT adopted, a caught raw error handed to comprehend(raw) fingerprints to the right corpus and returns its twin; an unknown error returns UNSTRUCTURED, never a wrong match; docs('<toy>', query) answers; installing the native toy flips precedence automatically; each config knob (prefer, pin, disable, require, local) demonstrably changes routing, and local mounts a private corpus for an internal package.
content_hash: 3754b73e33f62ac1
---

# Wave 4: The Sidecar Router

Estimate: 4-6 days.

## Features

| id | Feature | Type | depends_on |
|---|---|---|---|
| 19 | CC8 Native Precedence | SPEC | (none) |
| 20 | CC10 Honest Miss | SPEC | (none) |
| 21 | Fingerprint Index & Matcher | COMPONENT | 20 |
| 22 | Router & Precedence | COMPONENT | 19, 21, 12 |
| 23 | Config Loader | COMPONENT | 22 |
| 24 | Wrap Opt-In Proxy | COMPONENT | 22, 12 |

## Demo-state Result (unattended run, 2026-08-22)

Executed against the real runtime, not asked for confirmation
(unattended mode). Result: **MET IN FULL**.

- **`comprehend(raw)` on an un-adopted `@comprehendo/<toy>` fingerprints
  to the right corpus and returns its twin: MET.**
  `router-installed.test.ts`'s "an un-adopted toy package, end to end"
  suite writes a real corpus package to a real temp `node_modules`
  tree, discovers it off real disk, and matches through 21's real
  `FingerprintIndex` (no double anywhere in the chain). Re-run live in
  this session: 7/7 green.
- **An unknown error returns UNSTRUCTURED, never a wrong match: MET.**
  Same suite, same real tree, a raw text the installed corpus does not
  cover.
- **`docs('<toy>', query)` answers: MET.** Same suite; answers from the
  corpus package's real packed artifact through Docs Engine [13]
  unchanged.
- **Installing the native toy flips precedence automatically, no
  reconfiguration: MET.** `router-installed.test.ts`'s "installing the
  native toy flips precedence" suite writes, imports and RUNS a real
  natively-adopted toy package mid-test, catches the error it really
  throws, and hands it to the SAME router instance that answered from
  the sidecar a moment earlier; it now answers native, nothing
  reconfigured. 5/5 green, re-run live.
- **Each config knob (`prefer`, `pin`, `disable`, `require`, `local`)
  demonstrably changes routing: MET.** `router-knobs.test.ts`, one
  describe per knob, each asserting the pure decision AND the
  `comprehend`/`docs` surface an agent actually calls; mutation
  -verified per knob (disable 6 red, require 5, pin 4, local 9,
  ignoring `none` in `comprehend` 3, per 23's own doc). 26 tests,
  re-run live, green.
- **`local` mounts a private corpus for an internal package: MET.**
  `router-local-corpus.test.ts` writes a real corpus directory outside
  `node_modules` for a package never installed at all; the router
  twins its errors and answers its docs, and the private corpus joins
  the SAME fingerprint index installed corpora share (an overlapping
  fingerprint comes back ambiguous, an identical one refuses to
  build), so a private corpus can never silently outrank a published
  one. 12 tests, re-run live, green.

Wave-4 exit gate confirmed in this session: `packages/core` 538/538,
`packages/registry-tools` 41/41 (new package, built this wave),
`packages/spec` 418/418 unaffected; `tsc --noEmit`, `eslint .`, and
`tsc -p tsconfig.json` (build) all clean on the merged wave branch.
Three real defects found by independent review and fixed,
mutation-verified: 21's silent same-id-different-facets drop, 22's
silent unreadable-manifest defect-swallow (which then had to be
re-defended at the 23/24 merge, see 23's doc Fixed Issues), and
24's fluent-chain (`this`-returning method) routing escape.
