// The per-fixture proof that each must-fail fixture is genuinely
// non-conforming, in exactly the one dimension it claims (Negative Fixtures
// [05]).
//
// Five of the six gates named here do not exist yet: CC3 lands with [08] in
// Wave 2, CC7 with [09] in Wave 2, CC9 with [10] in Wave 2, CC8 with [19] in
// Wave 4, CC6 with [27] in Wave 5. Nothing in this file invents those gates'
// scanners. What it does instead is settle the question a future gate cannot
// answer for itself: is the fixture actually a violation, or does it merely
// claim to be one. A fixture that quietly conformed would make its gate pass
// and the CI red-on-pass rule meaningless.
//
// CC5's gate DOES exist in Wave 1, so the oversized topic is not asserted
// here at all, it is run through the real harness in negative-budget.test.mjs.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { readSchema } from './helpers/shapes.mjs';
import { check } from './helpers/validate.mjs';
import { fixtureNamed } from './helpers/fixtures.mjs';
import {
  EXPECTED_NEGATIVE_FIXTURES,
  negativeFixture,
  readNegativeText,
  resolveLocator,
  stepOf,
} from './helpers/negative.mjs';

/** Every top-level operator key of an `apply` expressed as a pipeline. */
const operatorsOf = (apply) => apply.flatMap((stage) => Object.keys(stage));

describe('raw-error-leak: the raw error is the primary message (CC3 [08], Wave 2)', () => {
  // Loaded per test, never at suite scope: a missing fixture must fail the
  // assertions that name it, not collapse the whole suite into one error.
  const load = () => negativeFixture('raw-error-leak');

  test('the twin surfaces the provider raw text verbatim as its reason', () => {
    const fixture = load();
    assert.equal(stepOf(fixture).response.reason, fixture.raw_error);
    assert.equal(resolveLocator(fixture, fixture.violation.locator), fixture.raw_error);
  });

  test('the raw text is nowhere else: it was moved into the primary slot, not copied', () => {
    const fixture = load();
    assert.equal(
      stepOf(fixture).response.received,
      undefined,
      'received is where an UNSTRUCTURED twin preserves the raw error; here it is empty',
    );
  });

  test('the positive kit handles this exact raw error correctly, which is the contrast', () => {
    // Same raw string, same UNSTRUCTURED code, opposite placement. This is
    // what makes the fixture a must-fail rather than an opinion.
    const fixture = load();
    const conforming = fixtureNamed('twin-round-trip.json')
      .steps.map((step) => step.response)
      .find((response) => response.code === 'UNSTRUCTURED');
    assert.ok(conforming, 'the positive kit no longer carries an UNSTRUCTURED twin');
    assert.equal(conforming.received, fixture.raw_error, 'the raw error belongs in received');
    assert.notEqual(conforming.reason, fixture.raw_error, 'and never in reason');
  });

  test('nothing else about the twin is wrong, so only CC3 can catch it', () => {
    const twin = stepOf(load()).response;
    assert.equal(twin.comprehendo, '0.1');
    assert.equal(twin.code, 'UNSTRUCTURED', 'an un-cataloged failure is honestly marked');
    assert.deepEqual(twin.fixes, [], 'and invents no fix, which is correct for UNSTRUCTURED');
  });
});

describe('schema-escaping-fix: an apply outside the declared call schema (CC7 [09], Wave 2)', () => {
  const load = () => negativeFixture('schema-escaping-fix');

  test('exactly one fix expresses an operation the provider never declared', () => {
    const fixture = load();
    const declared = fixture.declared_schema.operations;
    const fixes = stepOf(fixture).response.fixes;
    const escaping = fixes.filter(
      (fix) => operatorsOf(fix.apply).some((operator) => !declared.includes(operator)),
    );
    assert.equal(escaping.length, 1, 'exactly one violation, or no gate can be pinned down');
    assert.equal(escaping[0], resolveLocator(fixture, 'steps[0].response.fixes[1]'));
  });

  test('the locator points at the escaping apply, and the message names the operation', () => {
    const fixture = load();
    const declared = fixture.declared_schema.operations;
    const apply = resolveLocator(fixture, fixture.violation.locator);
    const outside = operatorsOf(apply).filter((operator) => !declared.includes(operator));
    assert.equal(outside.length, 1, 'one escaping operation, not a pile of them');
    assert.ok(
      fixture.violation.message.includes(outside[0]),
      `the diagnostic must name ${outside[0]}, not just say "rejected"`,
    );
  });

  test('the sibling fix stays inside the declared schema, so the kit is not just noisy', () => {
    const fixture = load();
    const declared = fixture.declared_schema.operations;
    for (const operator of operatorsOf(stepOf(fixture).response.fixes[0].apply)) {
      assert.ok(declared.includes(operator), `the conforming fix used ${operator}`);
    }
  });

  test('the escaping fix is otherwise a valid fix, it is only out of bounds', () => {
    const fixes = stepOf(load()).response.fixes;
    const { ok, errors } = check('fix.schema.json', fixes[1]);
    assert.ok(ok, `the escaping fix is malformed rather than out of bounds: ${errors}`);
    assert.ok(fixes[1].apply, 'the violation lives in apply, so apply must be present');
  });
});

describe('telemetry-attempt: corpus text that crosses the wire (CC6 [27], Wave 5)', () => {
  const load = () => negativeFixture('telemetry-attempt');

  test('every evidence token a scanner would hit is actually in the corpus text', () => {
    const fixture = load();
    const offending = resolveLocator(fixture, fixture.violation.locator);
    for (const token of fixture.network_evidence) {
      assert.ok(offending.includes(token), `the corpus text does not carry ${token}`);
    }
  });

  test('no other fixture in either kit carries a network token', () => {
    // Isolation is the point: if egress evidence were sprinkled around, a
    // gate firing would not tell you WHICH fixture it caught.
    const fixture = load();
    const others = EXPECTED_NEGATIVE_FIXTURES.filter((file) => file !== 'telemetry-attempt.json');
    for (const file of others) {
      const text = readNegativeText(file);
      for (const token of fixture.network_evidence) {
        assert.ok(!text.includes(token), `${file} also carries the network token ${token}`);
      }
    }
  });

  test('the topic is otherwise ordinary, which is exactly why it needs a scan', () => {
    const topic = stepOf(load()).response;
    assert.ok(topic.topic.length > 0);
    assert.ok(topic.summary.length > 0);
    assert.equal(topic.examples.length, 1, 'one example, and it is the offending one');
  });
});

describe('provider-side-corpus-veto: a manifest that suppresses a corpus (CC8 [19], Wave 4)', () => {
  const load = () => negativeFixture('provider-side-corpus-veto');

  test('the suppression key is present and is what the locator names', () => {
    const fixture = load();
    const manifest = stepOf(fixture).response;
    assert.notEqual(manifest[fixture.suppression.key], undefined);
    assert.equal(
      resolveLocator(fixture, fixture.violation.locator),
      manifest[fixture.suppression.key],
    );
  });

  test('no such field exists in the manifest shape: suppression is not declarable', () => {
    const fixture = load();
    const declared = Object.keys(readSchema('manifest.schema.json').properties);
    assert.ok(
      !declared.includes(fixture.suppression.key),
      'CC8 is structural: the manifest schema must have no suppression-shaped field',
    );
  });

  test('the shape still accepts it, so the rejection is CC8, never a schema error', () => {
    // Forward compatibility (RFC 11) requires unknown keys be ACCEPTED. That
    // is why this fixture matters: the only thing standing between a provider
    // and a corpus veto is the CC8 gate, not the validator.
    const manifest = stepOf(load()).response;
    const { ok, errors } = check('manifest.schema.json', manifest);
    assert.ok(ok, `the manifest must still validate, or the point is lost: ${errors}`);
  });

  test('the declaration itself is conformant, so only the veto is wrong', () => {
    const manifest = stepOf(load()).response;
    assert.equal(manifest.version, '0.1');
    assert.equal(manifest.level, 2);
  });
});

describe('computed-marker: a marker assembled at runtime (CC9 [10], Wave 2)', () => {
  const load = () => negativeFixture('computed-marker');

  test('the frozen forms are the literals CC9 freezes, one per ecosystem', () => {
    const { marker } = load();
    assert.equal(marker.frozen.javascript, "Symbol.for('comprehendo')");
    assert.equal(marker.frozen.python, '__comprehendo__');
  });

  test('every computed form is a different source text from its frozen literal', () => {
    const fixture = load();
    for (const [ecosystem, computed] of Object.entries(fixture.marker.computed)) {
      assert.notEqual(computed, fixture.marker.frozen[ecosystem]);
      assert.match(computed, /\+|join\(|`/, `${ecosystem} form is not actually computed`);
    }
  });

  test('and every computed form still assembles the exact marker value', () => {
    // The violation is not that the marker is wrong, it is that it is right
    // by arithmetic. Concatenating the string literals in each computed form
    // reproduces the marker payload, which is why a grep-level lint finds no
    // definition site while the value itself matches.
    const payload = {
      javascript: 'comprehendo',
      python: '__comprehendo__',
    };
    for (const [ecosystem, computed] of Object.entries(load().marker.computed)) {
      const pieces = [...computed.matchAll(/'([^']*)'/g)].map(([, piece]) => piece);
      assert.equal(pieces.join(''), payload[ecosystem], `${ecosystem}: ${computed}`);
    }
  });

  test('the probe answers exactly what the positive kit answers, so runtime cannot see it', () => {
    const probed = stepOf(load()).response;
    const conforming = fixtureNamed('probe-hit.json').steps[0];
    assert.equal(conforming.shape, 'entry.schema.json', 'the positive probe step moved');
    assert.deepEqual(probed, conforming.response);
  });
});
