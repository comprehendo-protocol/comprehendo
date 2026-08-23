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

**Provider SDK**, for a package adding native Comprehendo support:

```js
import { makeProvider } from 'comprehendo';

const provider = makeProvider(packedCorpus, hooks);
```

**Sidecar router**, for an agent-side consumer reading a package that
never adopted Comprehendo at all:

```js
import { createRouter, discoverInstalledCorpora } from 'comprehendo';

const environment = discoverInstalledCorpora({
  root: process.cwd(),
  buildIndex, // Fingerprint Index & Matcher [21]'s buildFingerprintIndex; see Known gap
});
const router = createRouter(environment);

router.comprehend(caughtError); // a structured twin, or an honest UNSTRUCTURED
router.docs('some-package', 'how do I do X'); // a topic-sized answer, or UNDOCUMENTED
```

**Docs over one already-loaded corpus**, and the **five consumer config
knobs** (`prefer`/`pin`/`disable`/`require`/`local`), are exported the
same way: `createDocs`, `CONFIG_KNOBS`, `TRUST_LEVELS`,
`parseConsumerConfig`, and the rest of `packages/core`'s built barrel.
Every export here is `@comprehendo/core`'s real, built code
(`packages/core`, this monorepo's internal SDK workspace), re-exported
unchanged; nothing in this package re-implements any of it.

## Known gap

`discoverInstalledCorpora`'s `buildIndex` parameter needs Fingerprint
Index & Matcher [21]'s real `buildFingerprintIndex`, which lives in
`@comprehendo/registry-tools`, not yet a standalone published package
(the dependency direction is one-way, registry-tools depends on core, so
core cannot import it back, and `createRouter`/`discoverInstalledCorpora`
take it as an injected port rather than reimplementing it). Until
registry-tools' fingerprint matcher is published on its own, an
agent-side consumer wiring the sidecar router for real needs to vendor
or reimplement that one function, or wait for it. Recorded here rather
than papered over with a silent stub.

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
