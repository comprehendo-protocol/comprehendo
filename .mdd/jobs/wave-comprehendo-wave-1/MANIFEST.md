# Wave job manifest: comprehendo-wave-1

mode: unattended
branch: wave/comprehendo-wave-1
started: 2026-08-22

## Lane plan

- batch 1 (parallel, 2): 01-cc2-shape-identity, 02-cc5-context-budget
- batch 2 (parallel, 2): 03-shape-schemas, 06-budget-harness
- batch 3 (sequential, 1): 04-conformance-fixtures
- batch 4 (sequential, 1): 05-negative-fixtures

## Features

- [x] 01-cc2-shape-identity (SPEC)
- [x] 02-cc5-context-budget (SPEC)
- [x] 03-shape-schemas (COMPONENT), 167/167 green, merged
- [x] 06-budget-harness (COMPONENT), 40/40 green, merged (207/207 combined with 03)
- [ ] 04-conformance-fixtures (COMPONENT)
- [ ] 05-negative-fixtures (COMPONENT)

## Judgment log

### 03-shape-schemas (13 calls, unattended, no blockers)

1. **Explanation is the tenth schema, though the doc's list names nine.** The
   doc's "What to Build" enumerates nine shapes and omits `explain(input)`'s
   response, but the doc's own Business Rules require a schema for every
   Protocol Surface row, and `explain` is one (spec line 561, RFC 5.4).
   Built `explanation.schema.json`. **Follow-up: doc's "What to Build" list
   is one shape short of its own Business Rules, worth a doc fix.**
2. `{valid: true}` (the `validate()` success arm) gets no schema: it's an
   anonymous inline RFC type, not a named Protocol Surface shape.
3. `UNSTRUCTURED` gets no schema: RFC 5.1.4 makes it a twin with
   `code: "UNSTRUCTURED"`, covered by twin.schema.json plus a worked example.
4. Five config knobs (RFC 10.5) are one object in one `config.schema.json`,
   not five files.
5. No value-level narrowing anywhere: `twin.code` is a plain string (RFC
   11 leaves code vocabularies to providers), no `minLength`/`format`, no
   enum beyond what the RFC states literally, `config.prefer` is a plain
   string not an enum.
6. No `additionalProperties: false` anywhere, RFC 11's additive-only rule;
   guarded by a test that walks every schema node and fails on a closed
   object, so a later edit can't silently narrow it.
7. `cause` (RFC 5.1.1, MAY-preserved raw error) is not added to
   twin.schema.json: RFC 6.1.1 puts it on `ComprehendoError`, not `Twin`.
   Schema stays open so a twin carrying it still validates; tested.
8. **Stack deviation, flagged for Wave 2:** used `node --test` plus `ajv`
   instead of the CLAUDE.md-documented Vitest, because `@comprehendo/spec`'s
   stated architecture is "depends on nothing, it is data" and Vitest would
   add roughly 100 transitive deps to it. Reconsider once packages with real
   runtime code land in Wave 2 (they should very likely use Vitest per the
   documented stack).
9. Verified live from both languages: ajv (Node) and `jsonschema` (Python,
   not added as a project dependency, used only as an independent second
   reader for the gate) load the identical files and agree on every case.
10. Ajv strict mode forced one schema idiom: rewrote a `$ref`-crossing
    `anyOf` branch as `{"required": [...], "properties": {"x": true}}` to
    keep strict mode on (deliberately, to catch typo'd keywords).
11. Split a 384-line test file into 5 files by Protocol Surface row to clear
    the 300-line size gate; pure move, same 164 assertions.
12. Feature doc frontmatter (`status`, `test_files`) intentionally left
    untouched by the builder; orchestrator (this manifest) owns that flip,
    done below.
13. No flow doc or `primitives` field existed for this SPEC-derived COMPONENT;
    treated the doc's Architecture section (registry-tools plus both language
    packages validate against these schemas) as the real entry surface and
    exercised it live (see 9).

### 06-budget-harness (11 calls, unattended, no blockers)

1. Test tooling: ESM plus `node --test`, matching the root package.json's
   existing script and the orchestrator's "minimal, match existing
   conventions" instruction, over the CLAUDE.md-documented Vitest. Same
   tension as 03's call 8, reconsider together in Wave 2.
2. `js-tiktoken@1.0.21` as a devDependency (not runtime): a real BPE
   tokenizer is required by the doc's must-not (no word/char proxy), kept
   dev-only so the package still ships zero runtime dependencies.
3. **Set the Wave-1 numeric budgets, closing the source spec's own open
   question:** index 1200 (baseline 914), topic 600 (baseline 383), priming
   150 (baseline 127, CC5's hard cap). `measured` is the max across both
   `o200k_base` and `cl100k_base` encodings (they disagree by real amounts,
   and 150 is a hard cap that must hold in either accounting), with the
   encoding recorded per record.
4. Budget record carries `encoding` as a fifth field, additive per the
   spec's forward-compat rule, appended after the four documented fields.
5. Payload measured as compact `JSON.stringify` for objects, trimmed text
   for text artifacts, matching what actually crosses into an agent's
   context (no pretty-print whitespace billed).
6. Tests use `await import(...)` per test, not top-level imports, so a
   missing module fails one test, not the whole file, giving honest
   per-test Red Gate evidence.
7. CI workflow wiring (`.github/workflows/`) deliberately deferred as
   `[deferred]`: shared infrastructure outside this feature's
   `source_files`, orchestrator's call. **Orchestrator note: not wired in
   this wave; carried forward as an open item, see wave completion
   report.**
8. Baseline fixtures authored fresh in `kit/budget/fixtures/` rather than
   borrowed from concurrent/unbuilt siblings (03, 04); the harness reads
   any artifact by path, which is the seam later waves use.
9. Index baseline authored at the spec's own stated reference scale (214
   topics, matching "~200 one-topic files"), so the budget isn't a one-way
   door against the corpus size the spec prescribes.
10. Headroom is bounded and tested: `baseline <= limit <= 2 * baseline`,
    plus a re-measure test that fails on baseline drift.
11. Ratchet (`assertRatchet`) is a tested pure function; CI supplying
    `previous` from the base ref is a workflow concern, split accordingly
    (see call 7).

### Orchestrator merge call: 03 and 06 both added packages/spec/package.json

Add/add conflict at merge time (06's worktree was cut before 03 merged).
Combined both features' devDependencies (ajv, js-tiktoken), kept 06's
`bin`/`scripts.budget`, broadened `scripts.test` to plain `node --test` so
it discovers both features' test file layouts. **Judgment call: kept
`private: true`** over 06's `private: false`, since nothing in Wave 1 sets
up a publish step and an accidental-publish guard costs nothing; flip it
when Wave 7 (Distribution) actually wires publishing. Regenerated
package-lock.json from scratch instead of hand-merging it. Full
packages/spec suite re-verified green after resolution: 207/207.
