# Judgment log, 18-python-core

Decide-and-log calls made while building the Python port. Anything blocking
(a fixture that looked wrong, a shared file outside `source_files`, a gate
over budget) would have stopped the build instead of landing here.

## 1. Interpreter: python3.13, not the system python3.10

The doc requires 3.11+. System `python3` is 3.10, so a venv built from it
would have silently downgraded the port (no `Self`, no PEP 646 syntax, and
`X | Y` in runtime-evaluated positions behaving differently). Built the dev
venv from `/usr/bin/python3.13` at `packages/python/.venv`, and set
`requires-python = ">=3.11"` in `pyproject.toml` without weakening it.
`packages/python/.gitignore` keeps the venv and caches out of the tree
(the repo `.gitignore` is a shared file this feature does not own).

## 2. Wire field names stay verbatim; API parameter names are Python idiom

CC2 [01] freezes the FIELD names of the wire shapes (twin, fix, topic,
index, entry, UNDOCUMENTED, UNVALIDATABLE, manifest, config). Every one of
those is already snake_case in the kit (`see_also`, `source_permitted`,
`would_execute`, `known_tool`, `own_terms`, `vocabularies_served`), so the
port copies them character for character and there is no translation layer
anywhere.

The provider-side authoring structures are NOT wire shapes and are not in
CC2's list: `ProviderCatalog`, `DeclaredCallSchema`, `ProviderHooks`,
`TwinContext`. TypeScript spells them `declaredSchema`,
`nestedPipelineOperations`, `twinResolvers`; Python spells them
`declared_schema`, `nested_pipeline_operations`, `twin_resolvers`. The
kit's own negative fixture already writes this structure as
`declared_schema` (`kit/negative/schema-escaping-fix.json`), so the Python
spelling is the kit's spelling, and `tests/test_conformance_kit.py` feeds
the fixture's block straight in without renaming a key.

## 3. Immutability: a dict subclass that refuses writes, not MappingProxyType

`Object.freeze()` has no exact Python counterpart, and the two obvious
candidates both break something load-bearing:

- `MappingProxyType` is not JSON-serializable, which would break the
  byte-identical serialization proof (CC2's whole point).
- A frozen dataclass would rename the wire fields into attributes and lose
  "the wire shape is the wire shape".

`comprehendo/_frozen.py` defines `FrozenDict(dict)` and `FrozenList(list)`,
which raise `TypeError` on every mutating method and serialize exactly like
the builtins they subclass (`json.dumps` walks the real storage). Same
guarantee as `Object.freeze` in the direction that matters: a published
twin, entry, or explanation cannot be re-pointed after the fact.

## 4. Marker probe: `getattr`, and never the instance `__dict__`

`hasattr(exc, "__comprehendo__")` is the documented one-line probe, so the
attribute has to be a real attribute reachable by `getattr`. The TS probe
uses a non-enumerable data property so the marker never serializes;
Python's equivalent is an instance attribute, which DOES show in
`vars(exc)`. The port keeps `probe()` a single `getattr` in a `try`
(so a booby-trapped `__getattr__` answers "no marker" instead of raising,
CC1 [07]) and the twin, not the marker, is what anything serializes.

## 5. Packed-corpus test fixture: a copy under `tests/fixtures/`, plus a
drift guard

The docs-engine scenarios need the same packed `mongodb-operator` artifact
`packages/core/test/fixtures/mongodb-operator.packed.json` carries, or the
kit's docs transcripts (probe-hit's index, probe-miss's `nearest`,
did-you-mean's `nearest`) cannot be reproduced at all. Reading core's test
fixture from a Python test would invert the declared dependency direction
(`python -> spec (fixtures only)`, never `python -> core`), so the port
carries its own copy at
`packages/python/tests/fixtures/mongodb-operator.packed.json` and
`tests/test_docs.py::test_packed_fixture_matches_the_core_copy` compares
the two byte for byte WHEN core's copy is present, so a drift between them
goes red in the monorepo while the Python package stays standalone-testable.
It is not a kit fixture and CC2's no-fork rule does not reach it; the kit
fixtures themselves are read in place, unmodified, from
`packages/spec/kit/`.

## 6. JSON Schema validation without a runtime or dev dependency

The TypeScript kit validates with Ajv. Adding `jsonschema` as a Python dev
dependency would be legal (dev-only) but makes the conformance run depend
on a wheel resolving. `tests/helpers/jsonschema_mini.py` implements exactly
the keyword subset the ten kit schemas use (`type`, `required`,
`properties`, `items`, `enum`, `const`, `anyOf`, `additionalProperties`,
`$ref` across the kit's own `$id`s) and nothing else: an unknown keyword
raises rather than being ignored, so the validator cannot silently pass by
not understanding a schema. `tests/test_jsonschema_mini.py` is the
anti-vacuity control: the validator must REJECT a missing required field, a
wrong type, a bad enum, a bad const, an `anyOf` miss, and an unknown
keyword, or the conformance run's green means nothing.

## 7. CC5 budget: the Python payload is measured by the existing Node
harness, over a process boundary

The budget harness is real tiktoken-class counting (`js-tiktoken`), and
there is no zero-dependency Python equivalent; a character or word proxy is
exactly what `kit/budget/README.md` forbids. So the Python-produced index,
topic, and priming payloads are written to a temp file and pushed through
the SAME harness the TS side uses, via its documented seam
(`node kit/budget/run.js --scope <scope> --file <path>`), and the test
asserts on the child's exit code and its JSON record. The fixture files are
not forked. This is a genuine process boundary and
`tests/test_budget_cc5.py` is its two-sided test: the parent asserts what
the child measured, not what the parent hoped.

## 8. `py/` (the PyPI name-reservation stub) is left untouched

`py/` reserves `comprehendo` on PyPI with a placeholder. This feature's
`source_files` is `packages/python/`, matching the `packages/core` /
`packages/spec` workspace convention. How the two relate at publish time
(the stub re-exporting from here, or being replaced by it) is a Wave 7
Distribution decision, the same deferral pattern as `packages/core` versus
the root `package.json` in Wave 2. Recorded as a `[deferred]` known issue
on the doc, not resolved here.

## 9. `[tool.comprehendo]` in this package's own `pyproject.toml`

The port declares itself in the manifest it reads: `version = "0.1"`,
`level = 2`. It is the live entry-surface evidence for the manifest layer
(`read_manifest_file()` answering from a real file on disk rather than a
temp fixture) and it costs nothing, being exactly the two fields CC8 [19]
allows.

## 10. Red Gate classification: 270 red, 62 green, and why the 62 are exempt

`pytest` at Phase 4 against the skeleton: **248 failed + 22 errors = 270 red**,
62 passed, 332 collected. Every one of the 62 falls in a category the build
flow exempts ("assert project-wide rule invariants, are not feature
skeletons"), and each was checked individually rather than waved through:

- **Kit invariants (44)**: the fixture and shape rosters, the envelope key
  order, every kit response validating against its shape, each negative
  fixture really being non-conforming in its one dimension, the kit naming no
  single language. These assert things about `packages/spec/kit`, not about
  this port; they would go red if the KIT broke, which is exactly their job.
- **The mini-validator's own control (13)**: `test_jsonschema_mini.py` proves
  the conformance run's validator can go red. It tests a test helper.
- **Structural scans (4)**: the import-closure scans (CC1, CC6) and the size
  gate pass on the skeleton because the skeleton imports nothing. They stay
  meaningful: they go red the moment an implementation reaches for `urllib`
  or a module passes 400 lines, which is the failure they exist to catch.
- **One negative control (1)**:
  `test_hasattr_answers_false_on_an_ordinary_error`. A plain `RuntimeError`
  carries no marker before OR after this feature exists, so it cannot be red
  first. Its positive counterpart
  (`test_hasattr_answers_true_on_a_marked_error`) was red, which is the pair
  that matters. Kept rather than deleted: an assertion that the probe does not
  answer on an unmarked value is what catches a future `__getattr__` that
  answers everything.

## 11. Block plan (Phase 5)

Layer 1: `_frozen.py` (the freeze primitive), then per-layer:

1. **marker** (`marker.py`), CC9 definition site, CC1 probe purity.
2. **twin** (`twin_validate.py` then `twin.py`), CC3/CC7 build-time gate
   including the two Wave-2 review fixes (catalog-time raw-leak check,
   nested-pipeline CC7 recursion).
3. **docs** (`docs_vocabulary.py` then `docs.py`), three-vocabulary matching,
   UNDOCUMENTED, the local miss log.
4. **sdk** (`sdk.py`), `make_provider`, Level 1/2 computation.
5. **manifest** (`config.py`), package.json + pyproject.toml, the three
   alternate TOML spellings refused.
6. **conformance** (`serialize.py` plus the cross-check suites), the byte
   -identical proof and the CC5 budget boundary.

Each block ends runnable, has its own verify command
(`pytest tests/test_<block>*.py`), and commits on its own.

## 12. `comprehend(raw)` is not in the surface this port mirrors

The feature doc's API/Interface names "Python equivalents of `comprehend(raw)`,
`docs(query?)`, `validate(input)`, `explain(input)`, mirroring the JS surface".
Three of those four exist in `packages/core/src` today. `comprehend(raw)` is
the AGENT-side entry that Router & Precedence [22] owns, which is Wave 4 and
unbuilt in TypeScript: there is no JS surface to mirror. Porting it here would
be building an unbuilt feature from a one-line mention, and it would have to
guess the router's precedence rules. Recorded as a `[deferred]` known issue on
the doc, with the wave that owns it named.

## 13. Commit shape: test-first, then source by layer

Mirrors the house style visible in wave 2 (`test(16-recorder): red-gate suite`
landing before `feat(recorder): ...`): the red-gate commit carries the
packaging, the helpers and every suite, and the source lands layer by layer
after it. The consequence, same as wave 2's, is that the intermediate trees do
not import: the barrel (`comprehendo/__init__.py`) re-exports the whole public
surface, so it lands with the last source layer and the final source commit is
the first green tree. The per-layer Green Gate results are recorded below
rather than inferable from the history.

Green Gate, per block, iterations used out of the five-iteration budget:

| Block | Iterations | Result |
|---|---|---|
| 1, marker | 1 | 35/35 green first run |
| 2, twin | 2 | the CC3 substring finding (see 14 below) |
| 3, docs | 3 | the packed-fixture drift and the ranking finding (see 15, 16) |
| 4, sdk | 2 | shared-mutable test-helper state, fixed in the helper |
| 5, manifest | 1 | green first run |
| 6, conformance | 2 | schema-file formatting scope, forward-compat container |

## 14. The CC3 catalog-time check is a substring test, and the kit trips it

`validate_catalog` flags `raw-error-leak` when an entry's `reason` CONTAINS its
`received`. The kit's `STAGE_UNKNOWN` twin is `received: "$grup"` with a reason
that necessarily names `$grup`, so cataloging that twin verbatim fails the
gate.

Not a fixture bug, and not a port bug: `packages/core/src/twin-validate.ts`
runs the identical check on the identical values. What it is, is a modeling
statement the port now makes explicit: `received` is what the RAISE SITE
observed, not catalog data, and supplied through `build(code, context)` where
it belongs, the twin round-trips byte for byte and the gate stays quiet.
`tests/test_twin_kit.py::raise_site_of` encodes that, and
`test_the_cc3_catalog_check_is_what_moves_received_to_the_raise_site` pins both
halves so neither can drift. Recorded as a `[gap]` on the doc.

## 15. Two `nearest` lists the ranking does not reproduce, verified by running
both implementations

`probe-miss` and `undocumented-source-pass` show `nearest` values this engine
does not reproduce exactly: one is a 1.0/1.0 tie that comes back in
corpus-index order, one gains a candidate whose fuzzy score sits exactly ON the
0.5 floor (`clause` against `place`, via `$match`'s SQL translation term).

I did not settle this by reading the TypeScript. I ran it: Node 24 strips types
natively, so `tests/test_cross_language_parity.py` imports
`packages/core/src/docs-vocabulary.ts` and `twin.ts` directly (an ESM resolve
hook maps the `.js` specifiers to `.ts`; nothing under `packages/core` is
written, copied or patched) and asserts the two implementations return the
IDENTICAL list for every query, and byte-identical twins for every kit twin.
They do, including both divergent cases. The TypeScript suite's own workaround
confirms it independently: `packages/core/test/docs.test.ts:334` sorts
`nearest` before comparing, for this exact pair.

So this is a property of the ranking against the test corpus's authored
`vocabularies_served`, which the kit deliberately does not carry, and `nearest`
is unordered and open in `undocumented.schema.json`. NOT a fixture bug, and no
fixture was touched. Recorded as a `[gap]` naming the spec question for the
kit's owner. The suites assert the candidate SET plus the cap, and pin the
exact engine output separately and out loud.

## 16. `packages/core`'s packed test fixture drifts from the kit transcript

`packages/core/test/fixtures/mongodb-operator.packed.json`'s
`aggregation stages` topic is missing the second worked example the kit's
`probe-hit` transcript shows, and orders `see_also` differently. A corpus that
answers a transcript's question with a different body cannot reproduce the
transcript, which is why the TypeScript docs suite does not assert it.

The Python port's own copy was corrected to carry the kit body verbatim (its
`vocabularies_served` block untouched), and
`test_carries_every_topic_body_the_kit_transcripts_show_verbatim` now anchors
that fixture to the SPEC kit rather than to another package's test tree, which
is the better invariant anyway. Correcting core's copy is Docs Engine [13]'s
file, not this feature's: reported as a `[gap]` on the doc, not touched.
