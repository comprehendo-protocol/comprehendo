// The probe transcripts and the twin round-trip fixtures.
//
// Acceptance criterion 1: hit, miss, and mid-failure discovery. The scenarios
// are the discovery handshake of RFC 4, run end to end as data.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { fixtureNamed, stepsOfShape } from './helpers/fixtures.mjs';

const surfaces = (fixture, surface) => fixture.steps.filter((s) => s.surface === surface);
const first = (fixture, surface) => surfaces(fixture, surface)[0];

describe('probe-hit: a real corpus answers (RFC 4.2, 5.2)', () => {
  const fixture = () => fixtureNamed('probe-hit.json');

  test('the probe is answered with an entry, and it costs no argument', () => {
    const step = first(fixture(), 'probe');
    assert.ok(step, 'the hit transcript never probes');
    assert.equal(step.input, null, 'the probe takes no argument (RFC 4.1)');
    assert.equal(step.shape, 'entry.schema.json');
    assert.equal(step.response.comprehendo, '0.1');
  });

  test('the entry declares the surfaces the transcript then calls', () => {
    const entry = first(fixture(), 'probe').response;
    const called = new Set(
      fixture()
        .steps.filter((s) => ['docs', 'validate', 'explain', 'comprehend'].includes(s.surface))
        .map((s) => s.surface),
    );
    for (const surface of called) {
      assert.ok(entry.surfaces.includes(surface), `entry omits the called surface ${surface}`);
    }
    assert.ok(called.size > 0, 'the hit transcript calls no surface');
  });

  test('the entry never lists twinned errors as a surface (RFC 4.2)', () => {
    const entry = first(fixture(), 'probe').response;
    assert.ok(!entry.surfaces.includes('errors'));
    assert.ok(!entry.surfaces.includes('twin'));
  });

  test('docs() with no argument returns the index, topic names only', () => {
    const step = fixture().steps.find((s) => s.surface === 'docs' && s.input === null);
    assert.ok(step, 'the hit transcript never asks for the index');
    assert.equal(step.shape, 'index.schema.json');
    assert.deepEqual(Object.keys(step.response), ['topics']);
    for (const topic of step.response.topics) assert.equal(typeof topic, 'string');
  });

  test('a query returns one topic-sized answer, and that topic is in the index', () => {
    const index = fixture().steps.find((s) => s.surface === 'docs' && s.input === null).response;
    const asked = fixture().steps.filter((s) => s.surface === 'docs' && s.input !== null);
    assert.ok(asked.length > 0, 'the hit transcript never asks a question');
    for (const step of asked) {
      assert.equal(step.shape, 'topic.schema.json');
      assert.ok(
        index.topics.includes(step.response.topic),
        `the index does not carry the answered topic ${step.response.topic}`,
      );
    }
  });

  test('the level-2 surfaces answer with their own shapes, and explain does not execute', () => {
    const validated = first(fixture(), 'validate');
    const explained = first(fixture(), 'explain');
    assert.equal(validated.shape, 'unvalidatable.schema.json');
    assert.equal(validated.response.valid, null, 'abstention is null, never a boolean');
    assert.equal(explained.shape, 'explanation.schema.json');
    assert.ok('would_execute' in explained.response);
    assert.notEqual(explained.input, undefined);
  });
});

describe('probe-miss: the corpus cannot answer (RFC 5.2.3)', () => {
  const fixture = () => fixtureNamed('probe-miss.json');

  test('the miss is an UNDOCUMENTED, not an empty result and not a wrong topic', () => {
    const step = fixture().steps.find((s) => s.shape === 'undocumented.schema.json');
    assert.ok(step, 'the miss transcript carries no UNDOCUMENTED');
    assert.equal(step.response.code, 'UNDOCUMENTED');
    assert.equal(step.response.source_permitted, true);
  });

  test('the miss echoes the exact query that was asked', () => {
    const step = fixture().steps.find((s) => s.shape === 'undocumented.schema.json');
    assert.equal(step.response.query, step.input);
  });

  test('the miss carries did-you-mean candidates (CC10 [20])', () => {
    const step = fixture().steps.find((s) => s.shape === 'undocumented.schema.json');
    assert.ok(step.response.nearest.length > 0, 'an honest miss names what it was near');
    assert.ok(!step.response.nearest.includes(step.response.query));
  });

  test('the transcript probes first: a miss is still a conforming package', () => {
    assert.equal(fixture().steps[0].surface, 'probe');
    assert.equal(fixture().steps[0].shape, 'entry.schema.json');
  });
});

describe('probe-mid-failure-discovery: the twin self-identifies (RFC 4.4)', () => {
  const fixture = () => fixtureNamed('probe-mid-failure-discovery.json');

  test('the transcript starts at a caught error, never at a probe', () => {
    const steps = fixture().steps;
    assert.equal(steps[0].surface, 'error', 'discovery mid-failure starts with the failure');
    assert.equal(steps[0].shape, 'twin.schema.json');
  });

  test('the agent had never probed, and learns from the twin itself', () => {
    const { discovery, steps } = fixture();
    assert.equal(discovery.never_probed_before, true);
    assert.equal(discovery.learned_from.step, 0);
    assert.equal(discovery.learned_from.field, 'comprehendo');
    const learned = steps[discovery.learned_from.step].response[discovery.learned_from.field];
    assert.equal(learned, '0.1', 'the field the agent learns from carries the spec version');
  });

  test('the probe that follows is answered by the same provider that threw', () => {
    const { steps } = fixture();
    const probe = steps.find((s) => s.surface === 'probe');
    assert.ok(probe, 'the transcript never converts the discovery into a probe');
    assert.ok(steps.indexOf(probe) > 0, 'the probe must follow the failure');
    assert.equal(probe.response.comprehendo, steps[0].response.comprehendo);
  });

  test('the fix names a docs topic, and the transcript then asks for it', () => {
    const { steps } = fixture();
    const topicName = steps[0].response.fixes[0].docs;
    assert.equal(typeof topicName, 'string');
    const answered = steps.find((s) => s.shape === 'topic.schema.json');
    assert.ok(answered, 'the transcript never follows the fix into the corpus');
    assert.equal(answered.input, topicName);
    assert.equal(answered.response.topic, topicName);
  });

  test('the loop closes: the topic shows the twin the misuse produces (RFC 5.2.4)', () => {
    const { steps } = fixture();
    const twin = steps[0].response;
    const topic = steps.find((s) => s.shape === 'topic.schema.json').response;
    const shown = JSON.stringify(topic.examples);
    assert.ok(shown.includes(twin.code), `the topic never shows the ${twin.code} twin`);
  });
});

describe('twin-round-trip: the twin variants the RFC names (5.1.1, 5.1.4)', () => {
  const fixture = () => fixtureNamed('twin-round-trip.json');

  test('every step is a twin, and every twin self-identifies', () => {
    for (const step of fixture().steps) {
      assert.equal(step.shape, 'twin.schema.json');
      assert.equal(step.response.comprehendo, '0.1');
    }
  });

  test('the codes are distinct: one variant per code', () => {
    const codes = fixture().steps.map((s) => s.response.code);
    assert.deepEqual([...new Set(codes)].sort(), [...codes].sort());
  });

  test('the UNSTRUCTURED passthrough keeps the raw message and has no fixes', () => {
    const step = fixture().steps.find((s) => s.response.code === 'UNSTRUCTURED');
    assert.ok(step, 'the kit never exercises the unstructured passthrough');
    assert.equal(typeof step.response.received, 'string');
    assert.deepEqual(step.response.fixes, []);
    assert.ok(step.response.reason.length > 0);
  });

  test('a docs-only fix is a conforming fix (RFC 5.1.2)', () => {
    const docsOnly = fixture()
      .steps.flatMap((s) => s.response.fixes)
      .filter((fix) => !('apply' in fix));
    assert.ok(docsOnly.length > 0, 'the kit never exercises the inert docs-only fix');
    for (const fix of docsOnly) assert.equal(typeof fix.docs, 'string');
  });

  test('fixes are ordered most-likely-first', () => {
    const rank = { high: 0, likely: 1, guess: 2 };
    const ordered = fixture().steps.filter((s) => s.response.fixes.length > 1);
    assert.ok(ordered.length > 0, 'no twin in the kit carries more than one fix');
    for (const step of ordered) {
      const ranks = step.response.fixes.map((fix) => rank[fix.confidence]);
      for (const r of ranks) assert.notEqual(r, undefined, 'a fix has no confidence to order by');
      assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), step.step);
    }
  });

  test('no twin anywhere in the kit surfaces a raw error as its reason (CC3 [08])', () => {
    for (const { file, step } of stepsOfShape('twin.schema.json')) {
      assert.ok(step.response.reason.length > 0, file);
      assert.ok(
        !/^[A-Za-z]*Error:/.test(step.response.reason),
        `${file}: the reason is a raw driver message`,
      );
    }
  });
});
