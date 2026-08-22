# Judgment calls, 15-manifest-wiring

Decided and logged, none of them blocking. Anything that would have narrowed a
business rule, contradicted a doc, or touched a file this feature does not own
is at the bottom, under "Raised, not decided".

## 1. A minimal TOML writer/reader, not a dependency, and not a TOML parser

Zero runtime dependencies is a hard constraint (CLAUDE.md, RFC Tech Stack), so
no npm TOML package. What `[tool.comprehendo]` needs is two flat fields, one
string and one integer, in one table, which is a line-oriented job, not a
parse-tree job. `config.ts` therefore reads and writes exactly the standard
table-header form:

```toml
[tool.comprehendo]
version = "0.1"
level = 1
```

Everything else in the file is preserved byte for byte, including comments,
because the writer never re-serializes the document; it edits the table's own
lines and leaves the rest of the text untouched.

The honest half of a minimal reader is what it does with the spellings it does
NOT handle. TOML can express the same table as `[tool]` + `comprehendo = {...}`
or as a dotted `tool.comprehendo = {...}` assignment. A reader that answered
"absent" there would report "this package does not speak Comprehendo" about a
package that does, which is the one wrong answer available. So those spellings
come back as `{status: 'unreadable', reason}` naming the limitation, and the
writer REFUSES them rather than appending a second `[tool.comprehendo]` table
(which would make the file invalid TOML for everyone else).

## 2. Reading is three-state, not `T | undefined`

`readPackageJson` / `readPyproject` / `readManifestFile` return
`{status: 'absent'} | {status: 'declared', declaration} | {status: 'unreadable', reason}`.

Collapsing the last two into `undefined` conflates "this package makes no
claim" with "this package makes a claim I could not read", and static
discovery is exactly the place where that difference decides whether a tool
skips a package or reports a broken manifest. Writing stays strict: a
declaration that would not validate against `manifest.schema.json` throws
`ManifestError`, because writing a malformed claim is this package's own bug,
not a stranger's.

## 3. The stamper never rewrites a file it does not need to change

`stampPackageJson` re-serializes the parsed JSON (indentation detected from
the original, trailing newline preserved). That normalizes exotic formatting,
which is a real, if small, cost on a foreign package.json. The mitigation is
that `stampManifestFile` compares the declaration already on disk first and
does not write at all when it matches, so an already-stamped package is never
reformatted and the operation is idempotent at the byte level. Tested both
ways (idempotent text, and no write when unchanged).

## 4. The stamper merges into the `comprehendo` key, never replaces it

`config.schema.json` puts the CONSUMER's five knobs under the same
`comprehendo` key in package.json, and `manifest.schema.json` is an open
object that RFC section 10.6's endorsement keys (`corpus`, `owners`) also ride.
A provider-side stamp that replaced the key would delete a consumer's own
configuration. So the stamp sets `version` and `level` and preserves every
other key, in place.

The reverse direction is CC8's structural guarantee and is NOT symmetric: the
provider-side READ projects exactly `MANIFEST_FIELDS` (`version`, `level`) and
nothing else, so a provider who writes `disable`, `prefer`, or an invented
`suppress` field into their own manifest gets a declaration with two fields
and no suppression reachable through any provider-side export. Scanned in
`config-cc8.test.ts` against the schema files themselves, not against a
hand-copied field list.

## 5. `Discovery.surfaces` is absent, never `[]`, on a manifest-only resolution

Static discovery cannot know which callable surfaces exist; only the marker
carries that. `[]` would be a claim that none exist, which is false. Absent is
the honest answer, and it matches the disagreement fixture's `resolved` block
exactly when the marker IS present (`{comprehendo, level, surfaces, source}`).

## 6. Scope of the CC8 scan in this feature

CC8's enforcement gate is Wave 4's Router & Precedence [22] + 19-cc8. What is
provable here, and all this feature claims, is the schema half: the
provider-side manifest has no field that could suppress a registry corpus,
proved as a static scan over `manifest.schema.json` plus the projection in
`config.ts`, in the same shape CC1/CC9's scans in 11-marker-probe already use
(read the source/schema, assert the absence).

## 7. File size

`config.ts` lands over the build skill's default 300-line advisory. The
project's own limit is 400 (CLAUDE.md, "one responsibility per file, max 400
lines") and this package already ships `twin-validate.ts` at 348, so 400 is
the operative number. Splitting the TOML half into a second file was the
alternative and was rejected: `packages/core/src/config.ts` is this feature's
only owned source file, and inventing a second one during a parallel wave
build is exactly the shared-surface growth the lane plan exists to prevent.

## Raised, not decided (for the orchestrator)

- **`packages/core/src/index.ts` is NOT touched.** The barrel's own comment
  anticipates a `config.ts (15)` line, but the barrel is a shared file, this
  feature doc's `source_files` is `[packages/core/src/config.ts]` alone, and
  16-recorder is building concurrently against the same barrel comment block.
  The feature doc also says the manifest is "N/A as a consumer-callable
  surface", so nothing is unreachable without the barrel line. Adding it is a
  one-line, conflict-prone edit that belongs to whoever serializes the wave.
- **`.mdd/docs/15-manifest-wiring.md` is NOT modified** (no status flip, no
  `test_files` write): Phase 7 and all bookkeeping belong to the orchestrator.
  The files this build actually wrote are in the result report.
- **A natural seam left unwired, deliberately:** `comprehendo init`
  (17-corpus-generator) writes a `manifest_hint` into the authoring corpus
  that the author is told to paste into their package.json by hand. That paste
  is exactly `stampManifestFile`. Wiring it would edit `src/cli/*`, which this
  feature does not own, so the hint's shape is instead pinned by a test here
  (`config.test.ts` drives the real hint from `emptyCorpus` through
  `parseDeclaration` and `stampPackageJson`), and the wiring is left to
  whoever owns the CLI next.

## 8. Seven of the 69 new tests were green at the Red Gate, on purpose

All seven are static scans, and a static scan over data that Wave 1 already
wrote (`manifest.schema.json`, `config.schema.json`) plus constants the
skeleton already declares cannot be red before the implementation exists
without being a fake assertion. This is the same exemption the build flow
gives rule-conformance specs, and the same shape CC1's and CC9's scans in
11-marker-probe already have.

They were not accepted on their word. Two targeted mutation rounds:

1. `MANIFEST_KEY` computed (`['compre','hendo'].join('')`) and `MANIFEST_FIELDS`
   grown a third `disable` field: 8 of 12 cc8 tests red, including the
   field-list scan, the consumer-knob overlap scan, and the key
   definition-site scan.
2. `manifest.schema.json` grown a `suppress_corpus` property, `PYPROJECT_TABLE`
   assembled at run time, and a second `Symbol.for('comprehendo')` added to
   `config.ts`: 9 of 12 red, including the veto-vocabulary scan, the pyproject
   literal scan, and the second-definition-site scan.

Both mutations were reverted; the only scan green through both is the
deliberate non-vacuity guard ("a scan over nothing proves nothing"), which is
the test that exists to make the others honest.

## 9. Where the file-size call landed

`config.ts` first came in at 451 lines and was brought to exactly 400, the
project's ceiling. What was cut was prose, not behavior: the module header and
several doc blocks were tightened, and the one real code change was factoring
the shared JSON host-parse out of `readPackageJson` and `stampPackageJson`,
which removed a duplicated try/catch pair rather than hiding anything. The
suite (347 core, 418 spec) is green before and after the trim, no test was
touched, and no function exceeds 50 lines.

## 10. Entry surfaces, exercised live

The feature doc says "N/A as a consumer-callable surface" and carries no
`primitives`, so there is no CLI verb or route to hit. The real surface is a
real manifest file on disk, and it was exercised live against the BUILT `dist`
output (not the test suite): a temp package.json already carrying a consumer
`disable` knob, and a temp pyproject.toml with only a `[project]` table, both
stamped, both read back, the re-stamp returning false without writing, and the
marker-vs-manifest resolution printed for a drifted manifest. Output captured
in the build report.
