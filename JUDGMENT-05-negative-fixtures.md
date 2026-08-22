# Judgment log, 05-negative-fixtures

Small decisions taken and logged (not blocking). Blocking items would have
stopped the build and been reported instead.

## J1. Wave-1 scope of "asserted to fail its gate"

The doc says each fixture is "asserted to fail its gate for its stated reason".
Five of the six gates (CC3/08, CC7/09, CC6/27, CC8/19, CC9/10) have no runtime
enforcer yet, they land in Waves 2, 4 and 5. Building those scanners here would
duplicate and preempt each contract's own component.

Decision: the Wave-1 kit ships the six fixtures plus the verification that is
actually possible now:
- `oversized-topic` is run through the REAL CC5 gate (06's `measureScope` and the
  `kit/budget/run.js` CLI) and proven to fail with the named count and budget.
- The other five are proven to be (a) valid instances of their Shape Schema [03]
  shape, so nothing is silently malformed, and (b) genuinely non-conforming in
  exactly the one dimension they claim, by content assertions written against the
  fixture, never by inventing the future gate's implementation.
Recorded in the doc's `known_issues`, one `[deferred]` entry per unbuilt gate,
naming its owning wave.

## J2. The `violation` block is a required envelope key, not an extra

04's envelope is `fixture, title, scenario, rfc, [extras], steps`. A negative
fixture needs a machine-readable statement of WHAT it violates and WHO must
reject it, and the doc requires the assertion to name "the specific rule
violated" rather than a bare non-zero exit. Decision: `violation` is a required
head key sitting between `rfc` and the scenario extras, with a fixed key order
(`rule, contract, wave, gate, reason, locator, message, enforced`). Everything
else about the envelope is imported from 04's helper, not copied, so "same
fixture format as [04]" is enforced by the code rather than by comment.

`violation.reason` is required to equal the scenario and the file stem, which is
what makes "raw-error-leak fixture unexpectedly passed" derivable mechanically.

## J3. The raw-leak fixture reuses the positive kit's raw error string verbatim

`raw-error-leak.json` carries exactly the raw text that `twin-round-trip.json`'s
UNSTRUCTURED step preserves in `received`. That coupling is deliberate: it lets
the negative test assert the SAME raw string is correctly placed in the positive
kit and mis-placed here, which is a far stronger proof of "non-conforming in
exactly one dimension" than any prose. The read is one-way (the negative suite
reads 04's fixtures, never writes them).

## J4. Language neutrality holds for five of six fixtures

04 forbids single-ecosystem idioms in a conformance fixture. Five negative
fixtures respect that (the telemetry attempt is expressed as a `curl` egress in
corpus text, not as an ecosystem's HTTP client, precisely so it stays neutral).

`computed-marker` cannot: CC9's violation IS the marker idiom. Decision: it is a
STATED exemption, and the exemption is itself asserted, it must name BOTH the
JavaScript and the Python forms, frozen and computed. A fixture naming only one
of them would have quietly become the JavaScript kit, which is the failure 04's
rule exists to catch.

## J5. No CI workflow file was added

The doc says the kit is "run by the same CI job that runs the positive
Conformance Fixtures [04]". That job is `npm test` in `packages/spec`
(`node --test`), which discovers the new `test/negative-*.test.mjs` files with no
configuration. `.github/workflows/` is shared infrastructure this feature does
not own (06 recorded the identical deferral), so nothing there was touched.

## J6. Test files live in `packages/spec/test/`, new files only

`source_files` for this doc is `packages/spec/kit/negative/`. The suite that
validates the kit goes in three NEW files under `packages/spec/test/` plus one
NEW helper, `test/helpers/negative.mjs`. No existing test file of 03, 04 or 06
was edited, and the helper imports 04's shared constants rather than re-inlining
them.

## J8. The dependency on Budget Harness [06] could not be declared

The negative kit genuinely depends on 06 (the budget test imports
`kit/budget/measure.js` and spawns `kit/budget/run.js`). Adding
`06-budget-harness` to `depends_on` was attempted and the frontmatter validator
hook rejected it: depends_on must point at LOWER ids only, and 06 > 05. Both
docs are in Wave 1 and 06 was built and merged before this feature, so the real
build order holds; only the declaration is impossible.

Decision: leave `depends_on` as the doc had it and record the fact as a `[gap]`
in `known_issues` rather than renumber a doc, weaken the rule, or pretend the
dependency is not there. Not treated as blocking: nothing is broken, the
declaration is merely unsayable in this schema.

## J7. The oversized topic is over budget by construction, and only that

The fixture had to exceed the 600-token topic budget without tripping any other
rule. It is a real, correct, plausible topic (a whole reference dumped into one
answer, which is the actual failure mode CC5 names), measured at build time
through the harness. A suite assertion holds the other five fixtures UNDER their
applicable budget, so "exactly one violation" is enforced across the kit rather
than asserted per file.
