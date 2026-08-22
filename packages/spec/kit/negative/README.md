# Negative fixtures (the must-fail kit)

The must-fail counterpart to every load-bearing rule. Each file here is a
deliberately non-conforming instance of a shape in `../shapes/`, and each one
names the gate that owes it a rejection. CI is red if any of these ever PASSES
its gate, full stop, no override.

Run by the same job that runs the positive kit (`npm test` in
`packages/spec`, which is `node --test`). The positive kit lives in
`../fixtures/` and nothing from here is ever mixed into it.

## The six

| Fixture | Rule | Gate owner | Enforced |
|---|---|---|---|
| `raw-error-leak.json` | CC3 [08] | Twin Builder [12], Wave 2 | not yet |
| `oversized-topic.json` | CC5 [02] | Budget Harness [06], Wave 1 | **yes, today** |
| `schema-escaping-fix.json` | CC7 [09] | Twin Builder [12], Wave 2 | not yet |
| `telemetry-attempt.json` | CC6 [27] | Submission Gate [29], Wave 5 | not yet |
| `provider-side-corpus-veto.json` | CC8 [19] | Manifest Wiring [15], Wave 4 | not yet |
| `computed-marker.json` | CC9 [10] | Marker & Probe [11], Wave 2 | not yet |

What each one breaks, in one line:

- **raw-error-leak**: the twin hands back the provider's raw error text as its
  primary `reason`. An un-cataloged failure is UNSTRUCTURED with the raw text
  preserved in `received`; the raw text is never the answer. The same raw
  string, correctly placed, is in `../fixtures/twin-round-trip.json`.
- **oversized-topic**: one query answered with the whole reference. Measured at
  1068 tokens against the 600-token topic budget by the real harness.
- **schema-escaping-fix**: a fix whose `apply` expresses `$out`, an operation
  the provider's declared (read-only) call schema does not contain. This is the
  fence the whole trust model rests on: corpus text is data, never instructions.
- **telemetry-attempt**: a corpus topic whose worked example posts the twin to a
  remote collector. Nothing crosses the wire in either tier.
- **provider-side-corpus-veto**: a manifest carrying a `registry` suppression
  field. The corpus about a package is the ecosystem's judgment, not the
  package's, and only the consumer can reverse precedence.
- **computed-marker**: the marker key assembled from string pieces at run time.
  The probe still answers correctly, which is the point: only a source scan
  can see it.

## The envelope

The positive kit's envelope (`../fixtures/README.md`) plus one required key,
`violation`, sitting between `rfc` and the scenario extras. The transcript is
still last, the step shape is unchanged, and the negative suite imports the
step constants from the positive kit's helper rather than copying them.

```jsonc
{
  "fixture": "raw-error-leak",     // equals the file name, without .json
  "title": "...",
  "scenario": "raw-error-leak",    // equals the fixture name: the scenario IS
                                   //   the violation
  "rfc": ["5.1.1", "5.1.4"],
  "violation": {
    "rule": "CC3",                 // the cross-cutting contract
    "contract": "08-cc3-no-raw-errors",   // its doc
    "wave": "comprehendo-wave-2",  // the wave whose component enforces it
    "gate": "twin-builder",        // who owes the rejection
    "reason": "raw-error-leak",    // the diagnostic name, so a failure reads
                                   //   "raw-error-leak fixture unexpectedly
                                   //   passed", never a bare red X
    "locator": "steps[0].response.reason",  // where the violation lives, in
                                            //   this file
    "message": "...",              // the diagnostic the gate must produce
    "enforced": false              // whether the gate exists yet
  },
  // OPTIONAL, scenario-specific: budget, declared_schema, marker,
  // network_evidence, raw_error, suppression. Always between `violation`
  // and `steps`.
  "steps": [ /* same step shape as the positive kit */ ]
}
```

## How to run the kit

1. Read each `*.json` file in this directory.
2. Validate every step's `response` against `../shapes/<step.shape>`. Every one
   MUST validate: these fixtures are non-conforming in one DIMENSION, never
   malformed. A fixture that failed schema validation would fail its gate for
   the wrong reason, which does not satisfy this doc.
3. Run each fixture through the gate its `violation.gate` names. Every one MUST
   be rejected, and the rejection MUST name `violation.reason`. A fixture that
   passes is a CI failure; a fixture rejected with the wrong diagnostic is also
   a failure.
4. Do not fix a fixture to make a gate pass. A fixture change is a breaking
   change, same rule as the positive kit.

The reference assertions are in `../../test/negative-kit.test.mjs` (the set),
`../../test/negative-violations.test.mjs` (each fixture really is a violation),
and `../../test/negative-budget.test.mjs` (the one gate that exists today, run
for real).

## What Wave 1 can and cannot prove

Only CC5's gate exists in Wave 1. `oversized-topic.json` is therefore measured
by the real harness and pushed through the real CLI:

```
$ npm run budget -- --scope topic --file <the topic response>
  FAIL  topic      1068 / 600  OVER BUDGET by 468
budget gate failed: topic measured 1068 tokens against a budget of 600 (OVER BUDGET by 468, o200k_base)
$ echo $?
1
```

The other five gates land with their own contract's component, in the wave the
table above names. Until then the suite proves the two things a fixture can be
wrong about on its own, and that a future gate cannot check for itself:

- the fixture is a VALID instance of its shape, so it is not silently
  malformed, and
- it is genuinely non-conforming in exactly the one dimension it claims (the
  raw string really is in `reason` and absent from `received`, the escaping
  `apply` really does name an operation outside `declared_schema`, the
  suppression key really is absent from the manifest shape, each computed
  marker form really does assemble the exact frozen value, the network evidence
  really is in the corpus text and in no other fixture).

The last one is enforced across the kit, not per file: every OTHER fixture's
budget-scoped steps (topic, index, or entry-priming shapes) are run through
the real gate and must stay UNDER budget; a step whose shape carries no CC5
budget category (twin, manifest) is checked to have none, not silently
skipped. A fixture that broke two rules at once could not tell you which
gate caught it.

## Rules this kit lives by

- **A negative fixture that passes its gate is a CI failure**, full stop, no
  override.
- **Each fixture isolates exactly one violation.**
- **Byte-identical, canonically serialized** (CC2 [01]), same as the positive
  kit: `JSON.stringify(fixture, null, 2)` plus one trailing newline.
- **Language-neutral**, with exactly one stated exemption:
  `computed-marker.json`, whose violation IS the marker idiom, must name BOTH
  the JavaScript and the Python forms. The exemption is asserted, not assumed.
