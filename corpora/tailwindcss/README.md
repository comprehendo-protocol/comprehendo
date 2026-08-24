# `@comprehendo/tailwindcss`

## Smoke test

The flagship twin, firing against the real, installed `tailwindcss@4.3.3`.
The traceback (real, unedited, `node example.mjs`):

```
Error: It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin. The PostCSS plugin has moved to a separate package, so to continue using Tailwind CSS with PostCSS you'll need to install `@tailwindcss/postcss` and update your PostCSS configuration.
    at Ra (.../tailwindcss/dist/lib.mjs:38:1643)
    at LazyResult.runOnRoot (.../postcss/lib/lazy-result.js:367:16)
```

routes, through this corpus's own fingerprint index, to
`TAILWIND_POSTCSS_PLUGIN_MOVED` (`node scripts/run-docs-code-blocks.ts
corpora/tailwindcss`, real output):

```
ok     corpora/tailwindcss/COMPREHENDO.md block 0 (javascript)
3 blocks, 3 passed, 0 failed
```

No guess: v4 split its PostCSS integration into its own package, and the
package's own error names the fix.

## Why this is likely the highest-value corpus shipped so far

Tailwind CSS v4 (the current major, first released 2025) is a genuinely
severe breaking change from v3: the CSS-directive entry point, the
config-loading model, and the PostCSS integration all changed shape at
once, and a coding agent trained mostly on pre-v4 code confidently writes
v3-shaped setup against a real v4 install. Two of this corpus's three twins
are the DANGEROUS kind: not a build failure, a build that succeeds with
broken output and nothing pointing at why.

## Real evidence backs every twin, none invented

- `TAILWIND_POSTCSS_PLUGIN_MOVED` (`runtime-error`): a real, synchronous
  throw. `tailwindcss` is a real, direct devDependency of
  `packages/registry-tools`; induction here calls the real package
  directly and catches what it really throws, no process to spawn, the
  same plainest form `corpora/zod`'s own `runtime-error` twins use.
- `TAILWIND_V3_DIRECTIVES_SILENT_NOOP` (`static-pattern`): a real, live CLI
  build, checked every test run. The old three-directive entry point
  (`@tailwind base;` / `components;` / `utilities;`) builds clean, exit 0,
  no warning, and produces a stylesheet containing only the license
  comment; real markup using `bg-red-500` produces zero occurrences of
  that class in the real output. The identical markup against
  `@import "tailwindcss";` instead produces the real class, confirmed live
  in the same test.
- `TAILWIND_CONFIG_JS_NOT_AUTO_LOADED` (`static-pattern`): the same
  real-build evidence standard. A `tailwind.config.js` declaring a custom
  color produces zero occurrences of that color anywhere in the real
  output when nothing references it; the identical config produces the
  real color the moment `@config "./tailwind.config.js";` is added to the
  CSS entry point.

`test/helpers/tailwindcss-witnesses.ts` is where every one of these claims
is actually checked, live, every run, real CLI builds in disposable
workspaces, never simulated; `test/tailwindcss-corpus.test.ts` fails
loudly, naming drift, the moment any of them stops holding.

## `target.versions` is an honest, bisected range

`>=4.1 <5`, checked live at 4.1.0 and 4.3.3, every twin's real behavior
identical across the span. Deliberately does NOT start at 4.0.0: checked
live, and 4.0.0's real CLI throws a real, unrelated error of its own
(`Missing field 'negated' on ScannerOptions.sources`) against the exact
same input this corpus's `TAILWIND_V3_DIRECTIVES_SILENT_NOOP` witness
uses, a genuine early-release scanner bug, not the silent-noop behavior
this corpus documents. Rather than claim a range that includes a version
behaving differently, the range starts where the checked behavior actually
begins, the same discipline `openai-python`'s bisected `>=2.35 <4` range
sets.

## Every fix here is a runbook

None of the three fixes are schema-bound `apply` calls. Every real fix is
either a package swap plus a config edit (`@tailwindcss/postcss`) or a
literal source edit to the CSS entry point (`@import`, `@config`), and
`apply`'s grammar is call data against a declared surface, not a text
transform, the same reasoning `zod`, `openai-python`, and `mcp-oauth` each
give for their own multi-step fixes.

## Not covered here

Only three of the real v3-to-v4 breaking changes are cataloged, the ones
independently confirmed live to be genuine traps (one loud, two silent).
The important-modifier syntax change (`!` prefix vs. suffix) was checked
live and found inconclusive, both forms produced valid output against the
real CLI in a quick check, so it is not cataloged here rather than guessed
at; a deeper look is future work, not a silent gap.
