# `@comprehendo/node`

## Smoke test

The flagship twin, firing against the real runtime. Real, unedited output
(`node script.cjs`, where `script.cjs` awaits at its top level after being
required from CommonJS):

```
Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph
with top-level await. Use import() instead. To see where the top-level
await comes from, use --experimental-print-required-tla.
```

routes, through this corpus's own fingerprint index, to
`NODE_REQUIRE_ASYNC_MODULE` (`node scripts/run-docs-code-blocks.ts
corpora/node`, real output):

```
ok     corpora/node/COMPREHENDO.md block 0 (cjs)
ok     corpora/node/COMPREHENDO.md block 1 (javascript)
ok     corpora/node/COMPREHENDO.md block 2 (javascript)
ok     corpora/node/COMPREHENDO.md block 3 (cjs)
4 blocks, 4 passed, 0 failed
```

## This corpus targets the runtime, not an npm package

No `npm install` names `node`; it is already on the machine running the
agent's code, and its real, version-dependent behavior is exactly the kind
of thing training data goes stale on fastest, because it changes on Node's
own release cadence, not the ecosystem's. `target.source: "cli"`, the same
shape `corpora/ffmpeg` established for a binary with no package to install
(`declared_schema.surface: "node"`).

## Every entry was induced against the real, installed node, none was remembered

`packages/registry-tools/test/node-corpus.test.ts` spawns the real `node`
binary (this repository's own test runner is itself running under it, so
"the interpreter is missing" is not a real failure mode here the way it is
for `openai-python`'s separate Python venv), once per cataloged entry, and
routes the real stderr through the real fingerprint matcher.
`target.versions` is `>=24.7 <25`, checked live against 24.7.0 and 24.8.0
(both nvm-installed on the machine this corpus was built on); every twin's
real text was confirmed byte-identical across both.

**Two real, current findings that correct what training data widely still
gets wrong on this exact Node line, neither cataloged as a twin because
neither is a failure** (both documented in `topics/require-of-esm.md`
instead): `require()` of a real ES module that resolves synchronously now
SUCCEEDS, no `ERR_REQUIRE_ESM`, the multi-year assumption that `require()`
of ESM always throws is simply false on current Node; and `import`/
`export` syntax in a plain `.js` file with no `"type": "module"` is now
auto-detected and reparsed rather than throwing a `SyntaxError`, with a
`MODULE_TYPELESS_PACKAGE_JSON` warning naming the real fix. Both were
verified live before this README was written; neither is remembered from
training data, which is exactly the standard every other claim here holds
to.

## Fingerprints are stderr text, not error classes

The same reasoning `corpora/ffmpeg` and `corpora/openai-python` both give:
an agent reading `node`'s output has text, a real `SyntaxError`/
`ReferenceError` printed to stderr by the process that crashed, not a live
exception object it can inspect. Every entry declares a `message_pattern`
and no `exception`.

## Every fix here is a runbook

Every twin's real fix is a source-code edit (add `"type": "module"`, swap
`require` for `import`, wrap an `await` in an async IIFE), never a flat,
safe operation this corpus's own `declared_schema` could express as a
call. `apply` is omitted from every fix, the same honest disposition
`corpora/openai-python` uses for its own structurally multi-step
corrections; each fix is instead a docs pointer naming exactly what to
change and why.

## A third source-block shape: `cjs`, alongside `javascript`

Docs As Tests [37]'s `javascript` shape (added building `corpora/mcp-oauth`)
always writes a worked example to an `.mjs` file. This corpus's own subject
is precisely the difference between Node's two module systems, so an
`.mjs`-only executor cannot demonstrate a CommonJS-specific failure
(`NODE_TOP_LEVEL_AWAIT_IN_CJS`: top-level `await` is valid in an ES module,
so writing that example as `.mjs` would prove nothing). `scripts/
docs-transcript-workspace.ts` gained a small, genuinely reusable sibling,
`invokeCommonJS`, writing to `.cjs` instead; `run-docs-code-blocks.ts`'s
`SOURCE_LANGUAGES` table gained one entry, `cjs`. One twin
(`NODE_REQUIRE_ASYNC_MODULE`) needs two real files (a real ESM module with
top-level await, and the CJS file that requires it) to reproduce; since a
source block is exactly one file, that worked example writes its own
companion file to disk with `node:fs` before requiring it, real code that
really runs, not a fenced-but-inert illustration.
