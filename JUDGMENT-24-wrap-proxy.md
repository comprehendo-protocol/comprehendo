# Judgment log: 24-wrap-proxy

Unattended build, wave 4. Calls made and why. Call 1 is the load-bearing one
the orchestrator asked for explicitly; the rest are ordinary.

## 1. The router is injected, explicitly, as a required second argument

**The question.** The doc's signature is `wrap(target)`, but
`comprehend(raw)` is a method on a router built by
`createRouter(environment, config)` [22]. So `wrap` needs a router from
somewhere: an explicit parameter, or a default (a module-level singleton, a
lazily-discovered environment from `node_modules`).

**The call.** `wrap(target, via)`, with `via` REQUIRED. It accepts either a
Router object (anything with a `comprehend(raw)` method, so [22]'s `Router`
satisfies it structurally with no adaptation) or a bare
`(raw: unknown) => Twin` function. Passing nothing throws a `TypeError` that
names the fix, at the wrap call, not at the first caught error.

**Why.**

- 22's own doc rules on this already: "the module-level
  `import { comprehend } from 'comprehendo'` form ... is what Distribution
  (Wave 7) assembles; today the two calls are reached through that router
  object". 22 deliberately did NOT create a module-level singleton, and its
  known_issues records that whether one exists at all is Wave 7's call.
  A singleton invented here would pre-empt that ruling from a component that
  is not even sure it ships in the first release (this doc's own gap).
- A default would need a real `Environment`, which means discovery, which
  means filesystem I/O at import time in the one module whose headline
  must-not is "nothing global is ever mutated by importing this module".
  An import that reads `node_modules` is not a side-effect-free import.
- The alternative default, a null router that answers UNSTRUCTURED for
  everything, is worse than no default: it makes `wrap(target)` succeed
  while quietly guaranteeing that nothing is ever twinned.
- Testability follows for free: the suite hands `wrap` the REAL router built
  from 22's `createRouter` over the toy sidecar corpus, so what is exercised
  is the real routing path, never a stand-in comprehend.

**What Wave 7 changes.** Nothing here. If Distribution assembles a
module-level `comprehend`, a one-line convenience overload can default `via`
to it in the distribution layer; the core function keeps taking its world as
an argument, exactly like `createRouter` and `decideRoute` do.

## 2. The twin is attached to the caught error, which is re-thrown unchanged otherwise

The caller catches the SAME error instance, now carrying `.twin`. Stack,
prototype (`instanceof MongoServerError` still answers true), `code`,
`cause` and every custom field the target package put on it survive, which
is the only version of "transparent" that holds on the error path too.
Building a fresh Error would replace the caller's error with a comprehendo
one and throw away the stack that says where it happened.

Fallback, when the caught value cannot carry a twin (a thrown string or
number, a frozen or sealed error, an error that already has a
non-configurable `twin` of another shape): a fresh `Error` whose `message`
is `twin.reason` (never the raw text, CC3 [08]), with `cause` set to the raw
value so nothing is lost, carrying the twin. Tested both ways.

## 3. wrap attaches NO marker

`attachTwin` [12] also writes `Symbol.for('comprehendo')`. `wrap` does not
use it: the marker is a claim that the value came from a package that speaks
Comprehendo natively, and a sidecar twin routed by a consumer's own `wrap`
call is not that claim (CC8 [19]). Only `twin` is defined. A test asserts the
re-thrown error stays probe-negative and that `decideFor` still answers
`sidecar` for it, so wrapping can never flip precedence for the package it
wraps.

## 4. An already-twinned error passes through untouched

If the caught value already carries a usable twin (a natively adopted
package's own, or a second `wrap` further down the stack), it is re-thrown
exactly as caught and `comprehend` is not called. This keeps `wrap` idempotent
(`wrap(wrap(x))` is `wrap(x)` on the error path), and it is the same
deference `router.comprehend` already performs for a marked error carrying
its own twin: the native provider's twin, never the sidecar's.

## 5. Async: native promises are derived, other thenables are left alone

A method returning a native promise (`instanceof Promise`, or the
cross-realm `[object Promise]` tag) gets `.then(v => v, raw => { throw
twinned(raw) })` applied, so `await`, `.catch`, `.finally` and `Promise.all`
all see the twinned rejection with no work at the call site. The fulfilled
path returns the identical value.

A NON-native thenable (a lazy query builder whose `.then` triggers execution)
is returned untouched. Calling `.then` on it to install a rejection handler
would EXECUTE it, which is a behavior change on the non-error path, and the
non-error path must be identical. A test pins this: a lazy thenable comes back
as the identical object with its execution counter still at zero. The cost is
that a custom thenable's rejection is not routed; that is a documented
limitation, not an accident.

## 6. No deep wrapping

A wrapped method returning an object returns THAT object, not a proxy over
it; `wrapped.child === target.child`. Deep wrapping would break reference
identity everywhere (the loudest possible transparency violation) and would
spread the one fenced proxy across an object graph the caller never opted in
for. A caller who wants a nested handle wrapped calls `wrap` on it, per call
site, which is the whole design.

## 7. Proxy receiver is the target, not the proxy

`get` reads with the target as receiver and methods are invoked with the
target as `this` (when the caller called them off the proxy). Class instances
with `#private` fields work through the proxy for exactly this reason; with
the proxy as receiver they throw `TypeError: Cannot read private member`.
Two spec invariants are honoured alongside it: a non-configurable,
non-writable own function property is returned unwrapped (the `get` trap
invariant forbids anything else), and method wrappers are cached per
function so `proxy.method === proxy.method` holds.

## 8. Tests own two files, not one

`wrap.test.ts` (error routing, the fence) and `wrap-transparency.test.ts`
(the non-error path is identical, nothing global moves). They split on the
two halves of the doc's must-not, and the transparency half is the one a
future change is most likely to break silently.
