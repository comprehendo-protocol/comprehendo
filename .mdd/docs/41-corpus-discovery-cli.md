---
id: 41-corpus-discovery-cli
title: Corpus Discovery CLI
type: COMPONENT
path: Distribution / Corpus Discovery CLI
source_files: [packages/cli/src/main.ts, packages/cli/src/add.ts, packages/cli/src/registry-lookup.ts, packages/cli/src/installer.ts, packages/cli/src/index.ts]
status: complete
phase: all
last_synced: 2026-08-24
initiative: comprehendo
wave: comprehendo-wave-7
depends_on: [31-scoped-publisher, 27-cc6-no-telemetry]
tags: [cli, consumer-discovery, npm-registry, corpus-install, no-telemetry-boundary]
test_files: [packages/cli/test/registry-lookup.test.ts, packages/cli/test/installer.test.ts, packages/cli/test/add.test.ts, packages/cli/test/cli-main.test.ts]
known_issues:
  - "[gap] The root `comprehendo` npm package's `package.json` does not yet declare a `bin` field pointing at this package's build, so `npx comprehendo add <pkg>` is not yet a real, publishable command; today it runs as `node packages/cli/dist/main.js add <pkg>` from a checkout of this repo. Wiring the root package.json's `bin` and `files` to include `packages/cli/dist` is a small, separate change against the PUBLISHED npm surface (a bigger blast radius than this feature's own scope, built in an isolated worktree) and is deliberately left for the next session to make with the full repo in view, not guessed at here."
  - "[deferred] `packages/core/src/cli/main.ts`'s four author-side verbs (`init`/`scan`/`diff`/`pack`) and this package's `add` verb are two separate `run()` functions, unified only at this package's own `main.ts` dispatch layer. A single VERBS map spanning both packages was considered and rejected: it would require exporting @comprehendo/core's internal `VERBS` map (currently private to that module) across the CC6 boundary, and the four-name duplication (`CORPUS_VERBS` in this package's `main.ts`) is a smaller, more honest cost than widening core's export surface for one caller."
  - "[gap] `lookupCorpusPackage` reports only `dist-tags.latest`'s version; it does not fetch or report the corpus's own declared `target.package`/`target.versions` (which would need a second GET of the tarball or the package's own README/`comprehendo.corpus.json`). Kept minimal deliberately: this verb answers 'does a corpus exist and what version', not 'what does it document', which `docs()` already answers once installed."
  - "[deferred] On `not-found`, this verb prints a static pointer to `https://comprehendo.dev/most-wanted` rather than querying it. Registry Website [40]'s own known_issues already record that its most-wanted list's real GitHub target 404s today (`comprehendo-protocol/registry` does not exist as a repository) and that nothing publishes the built site at all; wiring a live query against infrastructure already known to be unbuilt would be dishonest. The pointer names intent, not a working feature."
  - "[gap] `.mdd/waves/comprehendo-wave-7.md` and `.mdd/initiatives/comprehendo.md` were both edited to register this doc (a new table row in wave 7, a new Scope decisions note in the initiative), following [39-registry-reservations](39-registry-reservations.md)'s own precedent as a feature that \"landed ad hoc... ahead of/after the formal wave build\" and was still retroactively registered. Neither file's `content_hash` was recomputed: the hashing tool the interactive `/plan-execute`/`/plan-sync` skills use (`.claude/hooks/lib/mdd-ensure.cjs` or equivalent) is not a file tracked in this repository, so it was not available to run from this background build. Both hashes are now stale relative to their file's real content, honestly wrong rather than silently right; a `/plan-sync` pass in an interactive session should recompute them."
---

# Corpus Discovery CLI

## What to Build

`comprehendo add <pkg>` checks whether a corpus is published for a target
package (`@comprehendo/<pkg>`, Scoped Publisher [31]'s own naming
convention) against the real npm registry, and installs it when asked.
Must-not: no silent, unconditioned, or background network call anywhere in
this project; this verb runs its one request only when a consumer or an
agent explicitly typed `comprehendo add`.

This closes a real, previously undesigned gap: every corpus already ships
as its own tiny npm package, and `discoverInstalledCorpora`
(`packages/core/src/router-discovery.ts`) already picks up anything
installed under `node_modules/@comprehendo/`, but nothing anywhere let a
consumer (or an agent working on their behalf) find out whether a corpus
for a package they are HOLDING but have not already installed a corpus for
even exists. The only prior path was a human who already somehow knew the
exact scoped package name, running `npm install` themselves.

## Architecture

A new package, `packages/cli/`, deliberately OUTSIDE
`packages/core/`/`packages/python/`/`packages/registry-tools/`: CC6 No
Telemetry [27] is an absolute, whole-package, tested boundary ("zero
network imports anywhere in `packages/core/`, `packages/python/`,
`packages/registry-tools/`", enforced live by
`packages/core/test/no-telemetry.test.ts` scanning for `fetch(` among
other network-capable builtins). `add`'s whole job is a real HTTP request,
so it structurally cannot live inside any of those three, and this feature
exists as a new package for exactly that reason rather than weakening or
carving an exception into CC6's scan.

| Module | Job |
|---|---|
| `packages/cli/src/registry-lookup.ts` | one real GET against `registry.npmjs.org`, name-validated first, injectable `Fetcher` |
| `packages/cli/src/installer.ts` | one real `npm install --save-dev`, injectable `Installer` |
| `packages/cli/src/add.ts` | the verb: lookup, optional install, the exit-code and report/JSON split |
| `packages/cli/src/main.ts` | the published bin's argv dispatch: `add` handled here, `init`/`scan`/`diff`/`pack` delegated to `@comprehendo/core`'s own `run` unchanged |

`add.ts` imports `corpusPackageName` from `@comprehendo/registry-tools`'s
built `publish.ts` (the SAME flattening Scoped Publisher [31] actually
publishes under, `@acme/widgets` -> `@comprehendo/acme__widgets`) rather
than reimplementing it: two independently-written copies of that rule
would drift the moment either one gets fixed. Importing a network-free
export FROM a CC6-scanned package into this one is fine; CC6 forbids
network code from EXISTING inside those three packages, not from being
depended on by something outside them, the same relationship
`scripts/run-docs-code-blocks.ts` already has with `packages/registry-tools`'s
built modules.

## Implementation Notes

- The naming convention IS the index. No second catalog to build, host, or
  keep in sync with what actually got published: `@comprehendo/<pkg>` on
  the real npm registry already answers "does a corpus exist", for free,
  at whatever scale the corpus library grows to.
- `add` gets its OWN small argv parser in `main.ts` rather than reusing
  `@comprehendo/core`'s `parseArgs`, because `parseArgs`'s `target`
  positional means "a local directory to resolve and scan" for the other
  four verbs, and `add`'s `target` means "an npm package name to look
  up", genuinely different semantics `parseArgs` was never built to carry.
- Both network-facing seams (`Fetcher`, `Installer`) are constructor-
  injected with real defaults (`fetch` itself, a real `spawnSync('npm',
  ...)`), the same seam-injection discipline this project already uses
  throughout (`packages/registry-tools/test/helpers/process-induction.ts`'s
  own `spawnOnce`, for one). Every automated test injects a fake; the one
  real network call proving the real wiring lives in `cli-main.test.ts`'s
  process-boundary describe block, against a package name manufactured to
  be impossible on the real registry, so the assertion is on the SHAPE of
  a real answer, never on any particular corpus's presence.
- A malformed or hostile target name is refused BEFORE a URL is ever
  built from it (`isValidNpmName`), the same "never build a request from
  unescaped input" discipline this project's http-security rule already
  states for a `RegExp`.

## Data Model

`RegistryLookup`, a discriminated union on `outcome`: `{outcome: 'found',
name, version}` (real `dist-tags.latest`), `{outcome: 'not-found', name}`
(a real 404), `{outcome: 'error', name, detail}` (an unreachable registry,
an unexpected status, unreadable JSON, or a name refused before any
request was sent).

`AddResult`: `{target, corpus, lookup, installed?}`, where `installed` (
`{ok, detail}`) is present only when `--install` was actually passed AND
the lookup found something to install.

## API/Interface

```
comprehendo add <target-package> [--install] [--json]
```

- `--install` runs `npm install --save-dev <corpus package>` for real once
  the corpus is confirmed to exist; without it, the exact command is
  printed instead. Default is print, never install: this touches the
  consumer's OWN `package.json`/`node_modules`, a real mutation of a
  project this verb did not create, so the safer default is report, the
  same "off by default, explicit opt-in" posture the reserved
  `comprehendo.json` layer's own security fence already established
  (MDs/comprehendo-spec.md SS9.1).
- `--json` emits one machine-readable `AddResult` record, nothing else.
- `init`/`scan`/`diff`/`pack` are unchanged, delegated verbatim to
  `@comprehendo/core`'s own `run`; every flag and exit code those four
  already had is untouched.
- Module exports (`packages/cli/src/index.ts`): `run`, `USAGE`, `runAdd`,
  `lookupCorpusPackage`, `isValidNpmName`, `installCorpusPackage`,
  `realInstaller`, plus the `Fetcher`/`Installer`/`RegistryLookup`/
  `AddResult` types.

## Business Rules

- `add` never runs unless a human or an agent explicitly typed
  `comprehendo add`; nothing else in this codebase ever calls
  `lookupCorpusPackage` or `installCorpusPackage`.
- One real registry request per invocation, nothing more: no retry storm,
  no background polling, no second request to enrich the result beyond
  `dist-tags.latest`.
- `--install` is required to actually mutate the consumer's project;
  without it, `add` only reports and prints the command.
- Exit codes: `0` found (and, if `--install` was passed, the real install
  also succeeded); `1` no corpus published for this target, the same
  "expected, non-error, nothing-to-do" bucket `comprehendo diff` already
  uses for "no drift"'s opposite (drift found is `diff`'s 1; here, NOT
  found is `add`'s 1); `2` an operational problem the caller can retry
  (bad usage, the registry unreachable or answering oddly, a real
  install that failed); `70` a bug in this tool, unchanged from Corpus
  Generator [17]'s existing contract.
- A name that does not match npm's own package-naming grammar is refused
  before a URL is ever built from it.

## Data Flow

`comprehendo add <target>` -> `corpusPackageName(target)` (Scoped
Publisher [31]'s own flattening) -> `lookupCorpusPackage` (one real GET,
name-validated first) -> found/not-found/error -> (found AND `--install`)
`installCorpusPackage` (one real `npm install --save-dev`) -> `AddResult`
-> report (prose or `--json`) -> exit code.

## Dependencies

- [31-scoped-publisher](31-scoped-publisher.md) (`corpusPackageName`, the
  exact naming convention this verb looks up)
- [27-cc6-no-telemetry](27-cc6-no-telemetry.md) (the boundary this whole
  package exists outside of, on purpose)

## Security

- No network code anywhere in `packages/core/`, `packages/python/`, or
  `packages/registry-tools/`; this package exists specifically so those
  three stay exactly as CC6 No Telemetry [27] requires. Reverified live:
  `packages/core/test/no-telemetry.test.ts` passes unchanged, 8/8, after
  this feature was built.
- Explicit, one-shot, opt-in: no silent or background network call. The
  registry lookup fires only on an explicit `comprehendo add` invocation,
  and the one thing that mutates a consumer's project (`npm install`)
  fires only when `--install` was also explicitly passed.
- The target name is validated against npm's own package-naming grammar
  BEFORE a request URL is built from it, refusing anything else outright
  rather than attempting to escape it.
- `npm install` runs as a real, argv-array `spawnSync`, never a shell
  string, so an operand can never become a second command, the same
  discipline Docs As Tests [37] already applies to a corpus's own
  transcripts.
- Nothing here signs or verifies what npm itself returns; this verb
  trusts the same npm registry infrastructure every `npm install` already
  trusts, the identical trust boundary Scoped Publisher [31]'s "The
  update channel" reasoning already accepted for corpus distribution as a
  whole (MDs/comprehendo-spec.md SS10.7).

## Acceptance Criteria

- [x] `comprehendo add <pkg>` reports whether a corpus is published,
      against the real npm registry, live-verified: a target with no
      published corpus (`totally-not-a-real-package-xyz-123`) reports "no
      comprehendo corpus published..." and exits 1; a malformed name
      (`not!a!valid!name`) is refused before any request and exits 2. Both
      proven via a real spawned process, `cli-main.test.ts`'s "the real
      process boundary" describe block.
- [x] A scoped target flattens to the exact name Scoped Publisher [31]
      would have published it under (`@modelcontextprotocol/sdk` ->
      `@comprehendo/modelcontextprotocol__sdk`), proven against the real
      shared `corpusPackageName` function, live-verified by hand
      (`node dist/main.js add @modelcontextprotocol/sdk --json`).
- [x] `--install` runs a real `npm install --save-dev`, and its real
      argv, real exit status, and real stderr are all asserted, with a
      failed install reported plainly and exiting 2, never silently
      swallowed. Every case hermetic except the one process-boundary
      proof above; the automated suite never runs a real `npm install`.
- [x] `init`/`scan`/`diff`/`pack` are unchanged: delegated to
      `@comprehendo/core`'s own `run`, live-verified (`comprehendo init
      /no/such/target` still reports core's own exact precondition
      message and exit code through this package's built bin).
- [x] CC6 No Telemetry [27]'s scan of `packages/core/`/`packages/
      registry-tools/` reports zero hits after this feature, unchanged:
      `packages/core/test/no-telemetry.test.ts` 8/8.

## Known Issues

- [gap] The root `comprehendo` package's `bin` is not yet wired to this
  package's build; `npx comprehendo add <pkg>` is not a real published
  command yet. See frontmatter.
- [deferred] Core's four verbs and this package's `add` are two `run()`
  functions unified only at this package's dispatch layer, not one
  shared VERBS map, to avoid widening core's export surface for one
  caller. See frontmatter.
- [gap] The registry lookup reports only the corpus's published version,
  not its declared target package/version range. See frontmatter.
- [deferred] The not-found pointer to comprehendo.dev/most-wanted is
  static, not a live query, because that infrastructure is itself
  unbuilt (Registry Website [40]'s own known_issues). See frontmatter.
- [gap] Wave 7 and the initiative doc were both edited to register this
  feature (following [39-registry-reservations](39-registry-reservations.md)'s
  own retroactive-registration precedent), but neither file's
  `content_hash` could be recomputed: the hashing tool the interactive
  `/plan-execute`/`/plan-sync` skills use is not tracked in this
  repository and was unavailable to this background build. A `/plan-sync`
  pass in an interactive session should recompute both.
