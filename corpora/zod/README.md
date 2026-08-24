# `@comprehendo/zod`

## Smoke test

The flagship twin, firing against the real, installed `zod@4.4.3`. The
traceback (real, unedited, `node example.mjs`):

```
ZodError: [
  {
    "expected": "string",
    "code": "invalid_type",
    "path": [],
    "message": "Invalid input: expected string, received null"
  }
]
```

routes, through this corpus's own fingerprint index, to
`ZOD_OPTIONAL_REJECTS_NULL` (`node scripts/run-docs-code-blocks.ts
corpora/zod`, real output):

```
ok     corpora/zod/COMPREHENDO.md block 0 (javascript)
4 blocks, 4 passed, 0 failed
```

No guess: `.optional()` never covered `null`, and it still doesn't.

## The first corpus to carry two fingerprint kinds

Every prior corpus (`ffmpeg`, `openai-python`, `mcp-oauth`) catalogs
`runtime-error` fingerprints only, matched against something a real process
really threw or really wrote to stderr. Two of this corpus's four twins are
that shape too (`ZOD_OPTIONAL_REJECTS_NULL`, `ZOD_DEEP_PARTIAL_REMOVED`),
induced the plainest way CC4 [26] asks for: zod is a direct devDependency of
`packages/registry-tools`, so induction here is calling the real, installed
package directly and catching what it really throws, no process to spawn,
no runtime boundary to cross.

The other two (`ZOD_REQUIRED_ERROR_PARAM_IGNORED`, `ZOD_RECORD_SINGLE_ARG_
REJECTED`) are `static-pattern`, a fingerprint kind Corpus Format [28] has
carried since Wave 1 with no real index behind it (an entry of this kind
was parsed, validated, and then silently excluded from every match, "who
runs it is not yet decided"). This corpus is the first real consumer, and
building it resolved that design gap for real:

- Fingerprint Index & Matcher [21] now compiles TWO real, separate indices,
  one per kind (`buildFingerprintIndex` for `runtime-error`,
  `buildStaticPatternIndex` for `static-pattern`), never a shared one. A
  `runtime-error` and a `static-pattern` fingerprint sharing literal text is
  structurally impossible to confuse: a caller (or the fingerprint-collision
  gate) must ask a specific kind's question, never a combined one.
- Submission Gate [29]'s fingerprint lint (`gate-fingerprint.ts`) checks
  BOTH indices for cross-corpus collisions now, not only the runtime one.
- Docs As Tests [37] gained a fourth worked-example shape, `pattern`: a
  static-pattern fingerprint matches literal SOURCE TEXT, never a caught
  error, so there is nothing to spawn and nothing that could "fail" at
  runtime the way a `sh`/`python`/`javascript` block does. A `pattern`
  block's own code is matched, in-process, against the corpus's real,
  compiled static-pattern index instead of being run.
- `.mdd/docs/42-static-pattern-matching.md` records the design.

## Real evidence backs both kinds, not just runtime-error ones

CC4 [26]'s folklore rule ("every cataloged pitfall is provoked by a real
test or deleted as folklore") does not relax for a fingerprint kind with no
process to spawn; the EVIDENCE standard is just honestly different:

- `ZOD_OPTIONAL_REJECTS_NULL`, `ZOD_DEEP_PARTIAL_REMOVED`: a real thrown
  error, caught, every test run.
- `ZOD_REQUIRED_ERROR_PARAM_IGNORED`: a real, live behavioral claim, checked
  every test run, that the custom message is genuinely, silently dropped
  (confirmed unchanged across zod 4.0.0 through 4.4.3). Also a real,
  confirmed TypeScript compile error (`TS2353`) against the exact literal
  this pattern matches, for a caller running a real TypeScript build; the
  pattern is cataloged for the caller who is NOT (plain JS, `as any`,
  `@ts-ignore`), where nothing else would ever catch this.
- `ZOD_RECORD_SINGLE_ARG_REJECTED`: a real, live `tsc` invocation against
  the real, installed zod's own `.d.ts`, confirmed every test run to
  produce the exact real `TS2554: Expected 2-3 arguments, but got 1`.

`test/helpers/zod-witnesses.ts` is where every one of these claims is
actually checked, live, every run; `test/zod-corpus.test.ts` fails loudly,
naming drift, the moment any of them stops holding.

## `target.versions` is an honest, checked range

`>=4 <5`, checked live at 4.0.0, 4.4.3, and the versions bisected while
confirming the required_error/record findings in between; every twin's real
text was identical across the whole span checked. No claim is made about
zod 3, a different package in every way this corpus documents (the whole
point of `removed-v3-methods` and `error-customization-migration` is what
changed leaving it).

## Every fix here is a runbook

None of the four fixes are schema-bound `apply` calls. Two are schema
REDESIGN decisions (`.nullish()` vs `.nullable()` is about what the real
data actually looks like, restructuring away from `.deepPartial()` needs
the schema's real shape); the other two are literal SOURCE EDITS
(`required_error` to `error`, adding `z.record`'s key argument), and
`apply`'s grammar is call data against a declared surface, not a text
transform. A runbook is the honest answer for all four, the same reasoning
`openai-python` and `mcp-oauth` give for their own multi-step fixes.
