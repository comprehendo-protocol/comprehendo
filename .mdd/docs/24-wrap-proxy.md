---
id: 24-wrap-proxy
title: Wrap Opt-In Proxy
type: COMPONENT
path: Core / Wrap Proxy
source_files: [packages/core/src/wrap.ts]
status: complete
phase: all
last_synced: 2026-08-22
initiative: comprehendo
wave: comprehendo-wave-4
depends_on: [22-router-precedence, 12-twin-builder]
tags: [wrap, opt-in-proxy, monkey-patch-boundary, explicit-adoption]
test_files: [packages/core/test/wrap.test.ts, packages/core/test/wrap-transparency.test.ts]
known_issues: [{type: deferred, note: "wrap ships as wrap(target, router); the doc's one-arg form needs a module-level comprehend that Wave 7 (Distribution) owns, the same call 22-router-precedence deferred."}, {type: deferred, note: "A rejection from a NON-native thenable (a lazy query builder) is not routed: installing a handler would require calling its then, which executes it, a behavior change on the non-error path. Native promises are routed."}]
primitives:
  - name: "wrap(target)"
    kind: function
---

# Wrap Opt-In Proxy

## What to Build

An explicit, opt-in proxy wrapper that routes a target package's calls
through `comprehend(raw)` on catch, for consumers who want automatic
twinning without calling `comprehend` by hand at every call site.
Must-not: nothing global is ever mutated by import; `wrap()` only affects
the specific target a caller explicitly wraps, and only because the
caller explicitly called `wrap()`.

## Architecture

`packages/core/src/wrap.ts`. Wraps calls into Router & Precedence [22]
(`comprehend(raw)`) and Twin Builder [12]. Whether `wrap()` ships in the
first release or waits for evidence is an open Wave-1 decision; this
component's design should not assume it ships day one.

## Implementation Notes

- This is the one place in the whole system where anything resembling
  monkey-patching happens, and it is fenced hard: explicit opt-in only,
  nothing global mutated by import, the "What this project is NOT"
  section's runtime-monkey-patcher exclusion applies to everything except
  this deliberately-scoped proxy.
- `wrap()` is also one candidate answer to "who runs `static-pattern`
  fingerprint matching" (the other being a lint integration); Wave 1 has
  not yet ruled on this.

## Data Model

N/A beyond the wrapped target itself; `wrap()` returns a proxy object with
the same surface as its target, transparently forwarding calls.

## API/Interface

- `wrap(target)`: returns a proxy over `target` that routes caught errors
  through `comprehend(raw)` automatically.

## Business Rules

- `wrap()` is explicit opt-in per call site; importing the package never
  wraps anything on its own.
- Nothing global is mutated: wrapping one target never affects any other
  instance of the same package, or any other package.
- The proxy is transparent: every non-error-path call behaves identically
  to the unwrapped target.

## Acceptance Criteria

- [x] `wrap(target, router)` returns a proxy whose non-error calls are
      indistinguishable from the unwrapped target (property access,
      sync/async methods, `this`/private-field binding via receiver
      substitution, no deep wrapping of nested objects).
- [x] A caught error through the wrapped target arrives twinned or
      UNSTRUCTURED via the router's `comprehend(raw)`, with no manual
      call needed at the call site. Verified live through the built
      `dist/` against a real discovered corpus, sync and async both.
- [x] Importing the package without calling `wrap()` leaves the target
      package completely unmodified (no global mutation).

## Dependencies

- [22-router-precedence](22-router-precedence.md)
- [12-twin-builder](12-twin-builder.md)

## Known Issues

- [gap] Whether `wrap()` ships in the first release or waits for
  evidence is an open Wave-1 decision in the source spec.
- [gap] Whether `wrap()` is one of the runners for `static-pattern`
  fingerprint matching is undecided (see Fingerprint Index & Matcher
  [21]'s Known Issues).

## Fixed Issues

### A method returning `this` broke routing for the rest of the chain (fixed 2026-08-22)

Found by review. `invoke` substitutes `this` back to the real target
when a call comes off the proxy, so a `#private`-field read resolves
correctly. That substitution is one-directional in the return path
too: a method of the fluent/chainable shape (`.where().sort()`, a
query builder or HTTP client returning `this`) handed the caller back
the raw, unwrapped target. The next call in the chain then ran
unwrapped, and an error it threw escaped completely unrouted, not
even UNSTRUCTURED, the exact silent failure the whole module exists
to prevent.

- Fixed by reversing the same substitution on the way out: a return
  value (sync or resolved-async) equal to `state.target` comes back
  as `state.proxy` instead. Mutation-verified: 4 new tests (sync and
  async, in both `wrap.test.ts`'s routing half and
  `wrap-transparency.test.ts`'s identity half), all 4 red without the
  fix, green with it.

## Interface Overview

`wrap()` is for a consumer who wants automatic twinning on every call into
a target without adding a `try/catch` plus `comprehend()` at each call
site. It is the one deliberately-scoped exception to "nothing global is
mutated": you opt in per target, explicitly.

| Name | What it does |
|---|---|
| `wrap(target)` | Returns a transparent proxy over `target` that automatically routes caught errors through `comprehend(raw)`. |

### wrap(target)

Wrap a client, module, or object you would otherwise call
`comprehend(raw)` on manually after every catch. Everything else about
`target` behaves the same; only the error path changes.

```js
import { wrap } from 'comprehendo';
const client = wrap(new SomeLibraryClient());
try {
  await client.doThing();
} catch (err) {
  // err is already twinned or UNSTRUCTURED
}
```
