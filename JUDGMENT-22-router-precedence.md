# Judgment log: 22-router-precedence

Unattended build, wave 4, batch 3. Calls made and why. The first entry is the
load-bearing one; the rest are ordinary.

## 1. Installed-corpus discovery: data at the seam, real files at the edge

**The question.** "Installed `@comprehendo/<pkg>` corpus" and "installing the
native toy flips precedence automatically" both read as if the router
discovers corpora and native adoption from the real environment (module
resolution, the filesystem). Building genuine node_modules-style resolution
inside a unit suite is large and environment-fragile; mocking it away instead
would leave the wave's demo-state claim ("verified live, no router
reconfiguration step") resting on a fake.

**The call.** Both, split at an explicit seam, neither half faked:

- `packages/core/src/router.ts` is PURE. It takes an `Environment` (what is
  installed, as data: one matcher over all installed corpora, a twin catalog
  and docs surface per corpus, and per-target native evidence) and answers
  `comprehend(raw)`, `docs(pkg, query)` and `decideFor(pkg)` from it. It
  imports no `node:` module (asserted by a source scan in
  `router-comprehend.test.ts`), so "comprehend(raw) performs no I/O" is a
  property of the module, not a promise in a comment. Every precedence rule,
  every fingerprint dispatch, every twin construction and every honest miss
  is decided here, in functions that take their world as an argument.
- `packages/core/src/router-discovery.ts` is the ADAPTER, and it is real. It
  reads an actual `<root>/node_modules/@comprehendo/*` tree off an actual
  disk: each corpus package's own `package.json`, its compiled fingerprint
  artifact, its twin catalog, its packed docs corpus, plus the TARGET
  package's real `package.json` read through Manifest Wiring [15]'s own
  `readManifestFile`. It returns an `Environment`. No mock filesystem, no
  in-memory fs shim.

**Why this shape and not the alternatives.**

- A router that did its own I/O per call could not be side-effect free, which
  the doc lists as a business rule. The seam is forced by that rule, not
  invented for testability.
- A router that only ever took hand-built data would make acceptance
  criterion 4 ("installing the native toy flips precedence automatically,
  verified live") unprovable: a test that hands the router a
  `{marker: entry}` object it wrote itself proves the router reads its own
  input, not that installation flips anything.
- So the adapter exists, and the flip is proven twice over, both against real
  files: `router-installed.test.ts` builds a real package tree in a real temp
  directory, discovers it, comprehends a real caught error into the sidecar
  twin, then writes a real natively-adopted toy package into that same tree,
  imports it for real, catches the error it really throws, and hands it to
  the SAME router instance, which now answers native. Nothing is
  reconfigured between those two calls, because nothing can be: the router
  object is not touched.
- The mechanism that makes "no reconfiguration" true rather than lucky is
  that the authoritative discovery channel is the marker on the caught value
  itself (Marker & Probe [11]), read at call time, for free, with no I/O.
  Installing a native implementation means the target starts throwing marked
  errors; the router sees that on the very next call. The manifest half (15,
  advisory) is what the adapter reads off disk, and a fresh discovery picks
  up a newly stamped manifest too, which the same suite also proves.

**What the adapter had to invent, and how provisional it is.** There is no
published on-disk shape for an installed sidecar corpus package yet: Corpus
Format [28] and Scoped Publisher [31] are Wave 5. The adapter reads three
runtime artifacts beside a corpus package's `package.json`, named after the
one convention that already exists in this repo (`comprehendo pack` writes
`comprehendo.packed.json`):

| File | Written by | Read as |
|---|---|---|
| `comprehendo.packed.json` | Corpus Generator [17] `pack` | Docs Engine [13] packed corpus |
| `comprehendo.fingerprints.json` | Fingerprint Index [21] `serializeIndex` | the fingerprint index entries |
| `comprehendo.twins.json` | (Wave 5) | Twin Builder [12] `ProviderCatalog` |

The target package name defaults to the corpus package's unscoped name and
can be overridden by a `comprehendoCorpus.target` key in the corpus
package's own `package.json` (a scoped target like `@foo/bar` cannot be
spelled inside `@comprehendo/<pkg>`). Recorded as a `[deferred]` known issue:
28/31 own the authoritative format, and this adapter is the first consumer
asking for one, not the ruling.

Deliberately NOT done: the adapter never walks a corpus SOURCE tree
(`comprehendo/topics/*.md`), which Corpus Format [28] forbids runtime code
from doing. It enumerates one directory level (`node_modules/@comprehendo/`)
to find installed packages, then loads named artifacts only.

## 2. Core does not import registry-tools, so the matcher arrives as a port

CLAUDE.md fixes the dependency direction one-way (`registry-tools -> core`),
and 21 recorded the same constraint from the other side (`rootDir` breaks on a
cross-package `src/` import). But 22's doc says the router consumes 21's
matcher, and reimplementing matching in core would be the worst answer
available.

Resolution: `router.ts` declares a structural port, `CorpusMatcher`
(`match(raw) => CorpusMatch`), whose shape is 21's `MatchResult` narrowed to
what the router uses. 21's `FingerprintIndex` satisfies it structurally with
zero adaptation, so the REAL matcher is what runs, while core's import graph
stays clean.

The tests then load 21's real matcher through a computed dynamic import
(`test/helpers/sidecar.ts`), typed against the port. That keeps 21's module
out of core's TypeScript program (a static cross-package import fails
`tsc --noEmit` with TS6059, verified) while still putting the genuine matcher
in the suite, rather than a double that would agree with whatever the router
did. The honest-miss twin (candidates named, CC10 [20]) is passed straight
through from the matcher's own result, never rebuilt here, so the router
cannot drift from 21's shape.

Wiring the default runtime matcher into the published `comprehendo` package
is Wave 7 (Distribution), which core's own `package.json` already declares.

## 3. `comprehend(raw)` returns a twin; the decision is a second, pure call

The doc's own usage example is `result.comprehendo` / `result.fixes[0]`, so
`comprehend(raw)` returns a Twin (or the UNSTRUCTURED twin), kit-shaped, with
nothing extra bolted onto it. The doc's Data Model decision record
(`{package, source, reason}`) is returned by `decideFor(pkg, raw?)` instead,
which is pure and callable on its own. Two surfaces, no twin-shape pollution,
and the decision stays inspectable, which Config Loader [23] will want.

`RouterDecision` carries one field past the doc's three: `discovery`, the
`Discovery` value Manifest Wiring [15]'s `resolveDiscovery` produced (so the
"which channel answered" question is machine-readable, not parsed out of
`reason`). Additive.

## 4. "Native handles the call" means defer, and deferring has a concrete answer

Native present with no override, at the `comprehend(raw)` surface: the router
returns the twin the value already carries (`err.twin`, which is what an
adopted package attaches at its throw site) and NEVER the sidecar twin. When
the value carries no twin of its own, the answer is UNSTRUCTURED, built with
Twin Builder [12]'s own `unstructuredTwin`, because that is exactly what the
native provider would itself answer for a failure its catalog does not cover.
Falling back to the sidecar twin there would be a silent CC8 violation
dressed up as helpfulness.

## 5. `docs(pkg, query)` answers from the sidecar even when the package is native

The narrowest call in this build, made deliberately. `docs(pkg, query)` names
a package explicitly, which a native docs call never needs (a native call
goes through the handle the agent is already holding), and the router holds
no handle it could forward to. Refusing to answer would mean returning
UNDOCUMENTED while a perfectly good installed corpus sits there with the
answer: a false "this is not documented", which is precisely the dishonesty
CC10 [20] exists to prevent. So docs answers, and `decideFor(pkg)` still
reports `source: 'native'` for anyone who wants to prefer the package's own
surface. Both halves are asserted in `router-docs.test.ts`, including the
decision-still-says-native part, so the narrowing is visible rather than
implied.

Precedence at the `comprehend(raw)` surface is untouched by this: that is
where both tiers can answer the same question implicitly, and there native
wins.

## 6. `docs(pkg)` with no query returns the menu

Docs Engine [13]'s surface is `docs(query?)`, and the index-not-the-meal rule
is its whole shape. The router's `query` parameter is optional for the same
reason; the doc's signature `docs(pkg, query)` is the two-argument case of it.

## 7. Only `prefer` is implemented here; the other four knobs are 23's

The doc's business rules name exactly one knob (`prefer`). `pin`, `disable`,
`require` and `local` belong to Config Loader [23] (Wave 4, batch 4, whose
doc owns `config.ts`). The router takes a `RouterConfig` with `prefer` today;
23 can widen it without reshaping this surface. Not implementing them here is
scope discipline, not an omission: each one needs its own tests and its own
demo line in the wave's demo-state.

## 8. Twin builders and docs surfaces are constructed once, at router creation

`createTwinBuilder` runs CC7 [09]'s whole-catalog gate at construction. Doing
that per call would be waste, and doing it lazily would move a corpus's
refusal to whenever the first matching error happened to arrive. So
`createRouter()` builds every installed corpus's twin builder eagerly: a
corpus that violates CC7 fails router construction, the same "exists whole or
does not exist" rule `makeProvider` follows.

## 9. The generated native toy speaks the protocol directly

The test fixture that plays "the native toy, now installed" is a real ESM
package written to a real temp directory. It cannot import core's TypeScript
source (Node loads it outside vitest's transform, verified), so it attaches
`Symbol.for('comprehendo')` and its own twin itself. A test asserts the
symbol it attaches is identical to core's `COMPREHENDO_MARKER`, so the
fixture cannot quietly stop being a real Comprehendo package.

## 10. The package barrel is not touched

`packages/core/src/index.ts` is not in this feature's `source_files`, and
sibling lanes build against the same package. The router's surface is
therefore importable as `@comprehendo/core/dist/router.js` (and from
`src/router.ts` in-repo) but is not re-exported from the barrel yet.
Recorded as `[deferred]`, same call 17 made about the CLI `bin` entry; whoever
owns the barrel adds one line.

## 11. Two files, not one

`router.ts` (pure routing) and `router-discovery.ts` (the filesystem adapter)
split on the I/O boundary, which is also what makes the no-`node:`-import scan
possible. `source_files` in the doc updated to match, the same correction 21
made.
