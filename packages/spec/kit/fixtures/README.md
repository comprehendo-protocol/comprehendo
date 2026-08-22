# Conformance fixtures (the positive kit)

The language-neutral fixture set both implementations run, unmodified, from
these exact files. A fixture is an INSTANCE of a shape in `../shapes/`, never a
new shape: nothing here invents protocol surface. The must-fail counterpart
lives in `../negative/` (Negative Fixtures [05]) and is never mixed in here.

These files are also the golden example set for the docs and for
`COMPREHENDO.md`: tests, docs, and agent context are one artifact, not three
that drift apart.

## The scenarios

| Fixture | What it pins |
|---|---|
| `probe-hit.json` | Probe transcript, hit. The entry, the index, one topic-sized answer, and the two level-2 abstention shapes. Carries the kit's provider, index, and worked topic. |
| `probe-miss.json` | Probe transcript, miss. A question the corpus cannot answer comes back UNDOCUMENTED, with did-you-mean and the source pass. |
| `probe-mid-failure-discovery.json` | Probe transcript, mid-failure discovery. An agent that never probed learns the fluent path from the caught twin's own `comprehendo` field, then follows `fixes[0].docs` into the corpus. |
| `twin-round-trip.json` | The three twin variants: fully structured, `UNSTRUCTURED` passthrough, and a docs-only fix. |
| `docs-three-vocabularies.json` | One topic asked three ways: the tool's own terms, a known tool's terms, task language. All three resolve to the identical topic. |
| `did-you-mean.json` | Both did-you-mean channels for one near miss: `accepts` on the twin, `nearest` on the docs miss. |
| `undocumented-source-pass.json` | The explicit, permitted, one-question source read: the grant, a second question needing its own grant, and an answered question granting nothing. |
| `forward-compat.json` | Documents carrying fields this spec version never defined MUST be accepted. The fixture that catches an implementation which rejects on unknown keys. |
| `disagreement.json` | The manifest declares one thing, the marker reports another, and the marker wins. |

## The envelope

Every file has the same shape, so a port writes one runner, not one per
fixture:

```jsonc
{
  "fixture": "probe-hit",       // equals the file name, without .json
  "title": "...",               // one line, what this fixture pins
  "scenario": "probe-transcript",
  "rfc": ["4.2", "5.2.1"],      // the RFC sections it exercises
  // OPTIONAL, scenario-specific: discovery, source_pass, unknown_fields,
  // disagreements, resolved. Always between `rfc` and `steps`.
  "steps": [                    // the transcript, always the last key
    {
      "step": "...",            // what happens, in one sentence
      "surface": "probe",       // probe | manifest | docs | validate |
                                //   explain | comprehend | error
      "input": null,            // the argument, or null where there is none
      // OPTIONAL, scenario-specific: vocabulary, did_you_mean
      "shape": "entry.schema.json",  // the schema `response` is an instance of
      "response": { }           // the shape instance, unmodified
    }
  ]
}
```

`surface: "error"` is not a callable: it is an operation that raised a twin,
and `input` is the invocation that raised it.

## How to run the kit

1. Read each `*.json` file in this directory.
2. For every step, validate `response` against `../shapes/<step.shape>`. Every
   one MUST validate, including the `forward-compat` responses.
3. Apply the scenario data on the envelope: `resolved` for the disagreement,
   `unknown_fields` for forward compatibility, `source_pass` for the
   UNDOCUMENTED gate, `discovery` for mid-failure discovery.
4. Serialize each fixture back out and compare bytes with the file on disk.

The reference assertions are in `../../test/fixture-kit.test.mjs` (the set) and
`../../test/fixtures-*.test.mjs` (per scenario).

## Rules this kit lives by

- **Byte-identical, canonically serialized** (CC2 [01]). The bytes are
  `JSON.stringify(fixture, null, 2)` plus one trailing newline, key order as
  authored. Field order, key casing, and null-versus-absent all matter, and a
  port that needs a fixture changed has found a SPEC bug: the spec gets fixed
  first, and no port ever gets a special-cased fixture.
- **A fixture change is a breaking change.** Outside the deliberate
  "spec bug, fix the spec first" path, it is rejected.
- **Nothing here is implementation-specific.** No language marker idiom, no
  manifest file name, no ecosystem vocabulary appears in any fixture, and a
  test enforces it. A fixture that only makes sense in one language is not a
  conformance fixture.
- **The values repeat on purpose.** A port must be able to read ONE file and
  run it, so the entry and the worked topic are duplicated across transcripts.
  Cross-fixture tests hold the copies identical, so a drifting copy goes red
  instead of quietly disagreeing.
- **The golden examples stay inside the CC5 budgets.** Every topic, index, and
  priming payload here is measured by the budget harness (`../budget/`); a
  golden example over budget would teach exactly what the budget forbids.

## Deliberate coverage gaps

`config.schema.json` is not exercised here: consumer configuration is not one
of this kit's scenarios, and it belongs to Router & Precedence [22] and Config
Loader [23]. `fix.schema.json` is covered transitively, through every twin's
`fixes`. Both absences are asserted by name in `fixture-kit.test.mjs`, so
adding a fixture has to update that list rather than silently widen the kit.
