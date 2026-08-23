# comprehendo

The protocol that makes software packages understandable to AI, and this
repo is its reference implementation. A package that speaks Comprehendo
answers the agent holding it: every error arrives as a structured twin
carrying its own executable fix, the complete reference lives in-process
and answers questions in the asker's own vocabulary, invocations can be
judged before they execute, and the whole system is taught to any agent
by a priming snippet of roughly one hundred tokens.

Full protocol, corpora, and the registry: https://comprehendo.dev.

## Install

```sh
npm install comprehendo
```

## Usage

The provider SDK, for a package adding native Comprehendo support:

```js
import { makeProvider } from 'comprehendo';

const provider = makeProvider(packedCorpus, hooks);
```

`makeProvider` is `@comprehendo/core`'s real, built `makeProvider()`
(`packages/core`, this monorepo's internal SDK workspace), re-exported
here unchanged; nothing in this package re-implements it.

## Known gap

The sidecar reading surface for an un-adopted package (`comprehend(raw)`,
`docs(pkg, query)`, Router and Precedence) is not yet re-exported from
this root package; today it is reached through `@comprehendo/core`
directly. Wiring it here is a real, undecided design question (a
default-installed router has a cost profile a provider-only SDK does
not), not an oversight papered over.

## Developing this monorepo

No npm workspaces; each package installs and builds on its own. Install in
this order, `packages/spec` first: `packages/core`'s own test suite reads
the real budget meter (`js-tiktoken`) out of `packages/spec`'s installed
dependencies.

```sh
npm install --prefix packages/spec
npm install --prefix packages/core
npm install --prefix packages/registry-tools
npm install --prefix packages/python  # (or: pip install -e packages/python)
npm install                            # this root package
```

`npm test` in `packages/core` and `packages/registry-tools` builds `dist`
itself first (`pretest`); this root package's `npm test` does the same for
`packages/core`. A fresh clone plus the install order above plus `npm test`
in each package needs no further undocumented step.

## This monorepo

- `packages/spec`, the normative protocol document plus the conformance kit.
- `packages/core` (this package's real content), provider SDK, sidecar
  router, consumer config loader.
- `packages/python`, the identical port, `comprehendo` on PyPI.
- `packages/registry-tools`, corpus format, submission gate, fingerprint
  index builder, the scoped `@comprehendo/<pkg>` publisher.
- `corpora/`, community-authored sidecar corpora, starting with the
  flagship `@comprehendo/ffmpeg`.
