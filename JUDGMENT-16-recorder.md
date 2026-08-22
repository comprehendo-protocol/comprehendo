# Judgment calls, 16-recorder

Small decisions taken and logged (nothing blocking). Each names what the doc
did not settle, what was decided, and why.

## 1. The module is NOT added to the package barrel (`src/index.ts`)

`packages/core/src/index.ts` carries a comment predicting `recorder.ts (16)`
as a future re-export, but it is not in this feature's `source_files`, and
15-manifest-wiring is building `config.ts` concurrently against the same
file. Two reasons not to touch it, either one sufficient:

- Lane safety: editing a shared file this feature's doc does not own is
  exactly what serializes a parallel wave.
- The doc itself: "API/Interface: N/A as a consumer-facing primitive; this is
  a maintainer-side opt-in wrapper, not part of the agent-facing surface",
  and the business rule "never included in a package's default runtime path
  when disabled". A barrel re-export would load `recorder.ts` on every
  `import 'comprehendo'`, which is the opposite of that rule.

A maintainer opts in with a deliberate deep import
(`import { recordProvider } from '@comprehendo/core/dist/recorder.js'`), which
is the correct shape for an opt-in debugging aid. The test
`makeProvider does not import the recorder` locks the "not on the default
runtime path" claim structurally.

## 2. Opt-in is an explicit option, never an env var

`enabled: true` on the options object, nothing else. An env var (or a "a sink
was passed, so they must want it on") would be an ambient switch: something
other than the maintainer's own code could turn the black box on. Off by
default means the default construction has no wrapper at all, and
`recordProvider(p)` returns `p` itself.

## 3. Zero overhead when off is IDENTITY, not a disabled branch

When off, `recordProvider` returns the same object reference, so every surface
the caller holds is the original closure. There is no per-call `if (enabled)`
to execute, because there is no wrapper. The test asserts this on the object
and on all six surfaces, which is the only form of "zero overhead" that is
falsifiable in a unit test.

## 4. Surfaces recorded: the six provider-level calls, not `twins.build`

The doc's `surface` vocabulary is `twin | docs | validate | explain`. Mapped:
`twinFor`, `errorFor`, `raise` all record as `twin` (with the method name in
the payload), `docs` as `docs`, and the two judge hooks as themselves. The raw
`twins` builder and `mark()` are passed through un-wrapped: `twinFor` already
delegates to `twins.build`, so wrapping both would double-record the same
event, and `mark()` is an attachment, not a call through the protocol.

## 5. Payload shape: `{ method, args }` in, `{ method, returned | thrown }` out

The doc fixes the record's four keys (`timestamp`, `direction`, `surface`,
`payload`) and leaves `payload` free-form. Without `method` a replay cannot
tell `twinFor` from `raise`, both of which record as `twin`. `thrown` rather
than `returned` for the throwing direction because a maintainer replaying a
session has to see that the call ended in a throw, and `raise()` ALWAYS ends
that way.

## 6. Errors are normalised before they are recorded

`JSON.stringify(new Error('x'))` is `{}`, so an unnormalised recording of
`errorFor`/`raise` would write a line with the interesting part missing. Errors
are recorded as `{ name, message, twin? }`. This also makes the docs engine's
own promise hold here: an injected sink sees exactly the records the file would
carry (asserted directly).

## 7. Log-write failures are counted, never thrown, never silent

Same shape as the Docs Engine [13] miss log: `try/catch` around the sink with a
`written`/`failed` counter, reachable through `recordingOf(provider).stats()`.
A recorder that broke the calls it was recording would be worse than no
recorder, and a silently broken one violates the logging rule's
"suppression needs a counter".

## 8b. One test line rewritten during Phase 6, strengthened, never weakened

`expect(off.twinFor).toBe(provider.twinFor)` tripped
`@typescript-eslint/no-unbound-method` (three of the six surfaces are declared
as METHODS on `Provider`, and naming one without calling it is exactly what
that rule refuses). The three identity checks now read through an index
accessor inside a loop AND additionally assert each surface is a function, so
the assertion got stronger, not softer. No expectation was removed or relaxed.

## 8c. `wrapSurfaces` / `twinSurfaces` extracted from `recordProvider`

Purely to keep every function under the 50-line gate; no behavior moved. The
largest function is now `wrapSurfaces` at 41 lines, the file is 290.

## 9. Default path `.comprehendo/recording.log`

Sits beside the docs engine's `.comprehendo/docs-usage.log`, relative (never
absolute), no `..` segment, and already covered by the repo's `*.log`
gitignore, so a maintainer cannot accidentally commit a session.
