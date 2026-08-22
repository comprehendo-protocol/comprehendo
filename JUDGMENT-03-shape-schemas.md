# Judgment log, 03-shape-schemas

Unattended build. Small calls decided and logged here; nothing in this list
was blocking. No contract violation, business-rule narrowing, or
destructive operation was reached.

## 1. Explanation is the tenth schema, though the doc's list names nine

The feature doc's "What to Build" enumerates nine shapes (twin, fix, topic,
index, entry, UNDOCUMENTED, UNVALIDATABLE, manifest keys, config knobs) and
omits the `explain(input)` response shape. Its own Business Rules say the
opposite: "Every schema file corresponds 1:1 to a shape named in the RFC's
Protocol Surface table ... no named shape lacks a schema." `explain(input)`
is a row in that table (mdd-comprehendo-spec.md line 561) and its response
is normative in the RFC §5.4, and the wave's demo-state is "every shape in
the RFC exists as a JSON Schema".

Decided: build `explanation.schema.json`. CLAUDE.md's tiebreak ("where a
doc and the RFC disagree, the RFC wins and the doc has a bug") points the
same way, and omitting it would leave `explain`'s response the one surface
Conformance Fixtures [04] cannot validate. Additive, so no risk of
narrowing anything.

Follow-up for the orchestrator: the doc's "What to Build" list is one shape
short of its own Business Rules. Worth a doc fix, not a code change.

## 2. `{valid: true}` gets no schema of its own

`validate(input)` returns `{valid: true}` or a twin or UNVALIDATABLE. The
success arm is an anonymous inline type in the RFC's TypeScript block, not
a named shape, so it is not a Protocol Surface shape and gets no file.
Inventing `valid.schema.json` would violate "no schema exists that the RFC
does not name". The twin and UNVALIDATABLE arms are both covered.

## 3. `UNSTRUCTURED` gets no schema of its own

RFC §5.1.4 makes the unstructured passthrough a twin with `code:
"UNSTRUCTURED"`, not a separate shape. It is covered as a worked example
against `twin.schema.json` instead.

## 4. Five config knobs, one schema file

The doc lists "the five consumer config knobs" as a single item and RFC
§10.5 shows them as one object under one manifest key. One
`config.schema.json` with five optional properties, not five files.

## 5. No value-level narrowing anywhere

The doc's must-not is explicit: "no schema narrows a field's allowed shape
below what the RFC allows." So:

- `twin.code` is a plain `string` with no SCREAMING_SNAKE `pattern`. RFC
  §11 puts twin code vocabularies in the provider's hands, not the spec's,
  so a pattern here would let this schema reject a conforming provider.
- No `minLength`, no `format`, no `uniqueItems` anywhere. The only enums
  and consts used are ones the RFC states literally (`confidence`, `level`,
  `surfaces`, `code: UNDOCUMENTED`, `code: UNVALIDATABLE`,
  `source_permitted: true`, `valid: null`).
- `config.prefer` values are `string`, not an enum of `native`/`sidecar`.
  The RFC's example shows only `sidecar`; enumerating the tier vocabulary
  would be a narrowing this doc has no mandate for.

## 6. No `additionalProperties: false`, anywhere, and it is tested

RFC §11 says fields are only added within a major and implementations MUST
ignore unrecognized fields. A closed object would reject a conforming
future document. `shape-set.test.mjs` walks every node of every schema and
fails on `additionalProperties: false` or `unevaluatedProperties: false`,
so the guarantee cannot be lost by a later edit. This also makes the
endorsement keys of RFC §10.6 (`corpus`, `owners`) validate against
`manifest.schema.json` without this version naming them.

## 7. `cause` is not added to the twin schema

RFC §5.1.1 says the raw error MAY be preserved in a `cause` field, but
§6.1.1 puts `cause` on the `ComprehendoError` class, not on `Twin`. Adding
it to the twin schema would be inventing a twin field. Because the schema
is open, a twin carrying `cause` validates anyway; there is a test for
exactly that.

## 8. Test tooling: node --test plus ajv, not Vitest

The orchestrator authorized minimal tooling under `packages/spec/`. The
repo's on-disk convention is `node --test` (root package.json); CLAUDE.md's
stack line says Vitest per package. Chose `node --test` with
`node:assert/strict`, ESM, because Vitest would put roughly a hundred
transitive dependencies under the one package whose stated architecture is
"spec depends on nothing (it is data)". Reconsider when packages that
actually contain runtime code land in Wave 2.

`ajv` (draft 2020-12) is the single devDependency. A hand-rolled validator
was the alternative and was rejected: a bespoke checker validating the
project's own frozen contract is exactly the shape of check that reports
green while asserting nothing.

## 9. Schemas verified live from Python as well as JavaScript

This feature implements CC2 (byte-identical shapes across languages), so
the entry-surface check was run twice: once through ajv from Node and once
through `jsonschema` from Python 3, both loading the identical files from
`packages/spec/kit/shapes/`. Same verdicts on the same inputs. Python's
`jsonschema` is not added as a project dependency; it was used as an
independent second reader for the gate only.

## 10. Ajv strict mode forced one schema idiom

`"anyOf": [{"required": ["apply"]}, {"required": ["docs"]}]` trips ajv's
`strictRequired` across a `$ref` boundary. Rewrote the branches as
`{"required": ["apply"], "properties": {"apply": true}}`, which is
semantically identical (`true` is the always-valid schema) and keeps ajv
strict mode ON. Kept strict on deliberately: a typo'd keyword in the
project's frozen contract must be an error, not a silently ignored
annotation.

## 11. Split the rules test file to clear the size gate

`shape-rules.test.mjs` reached 384 lines, over the 300-line default. Split
by Protocol Surface row into `error-shapes`, `docs-shapes`,
`judgment-shapes`, `discovery-shapes`, and `forward-compat`, with the
shared `check`/`without`/`withField` helpers extracted to
`test/helpers/validate.mjs`. Pure move, no assertion changed, test count
unchanged at 164.

## 12. Did not touch the feature doc

Frontmatter `test_files` is still `[]` and `status` is still `planned`. The
orchestrator owns Phase 7 and the status flip. The test files this build
wrote are listed in the result report so they can be recorded there.

## 13. No flow doc existed

`.mdd/audits/` does not exist and no flow doc was supplied, so no process
boundaries and no entry surfaces were named for me to iterate. The doc has
no `primitives` field and its API/Interface section reads "N/A at this
layer". Treated the consumer contract in the doc's Architecture section
("registry-tools, comprehendo npm, and comprehendo PyPI all validate
against these schemas") as the real surface and exercised it live from both
languages (see 9).
