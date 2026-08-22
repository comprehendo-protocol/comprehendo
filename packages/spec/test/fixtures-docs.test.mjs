// The docs-surface fixtures: three vocabularies, did-you-mean on both
// channels, and the UNDOCUMENTED source pass.
//
// Acceptance criteria 4 and 5. Also the budget cross-check: the kit doubles as
// the golden example set, so a golden example over a CC5 [02] budget would be
// the spec teaching exactly what the budget forbids.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { measureScope } from '../kit/budget/measure.js';
import { fixtureNamed, stepsOfShape } from './helpers/fixtures.mjs';

const kitIndex = () =>
  fixtureNamed('probe-hit.json').steps.find((s) => s.shape === 'index.schema.json').response;

describe('docs-three-vocabularies (RFC 5.2.1)', () => {
  const fixture = () => fixtureNamed('docs-three-vocabularies.json');

  const asked = (kind) => fixture().steps.find((s) => s.vocabulary.kind === kind);

  test('all three vocabularies are exercised, each labelled', () => {
    const kinds = fixture().steps.map((s) => s.vocabulary.kind);
    assert.deepEqual([...kinds].sort(), ['own-terms', 'task', 'translation']);
  });

  test('each vocabulary asks a different question', () => {
    const queries = fixture().steps.map((s) => s.input);
    assert.equal(new Set(queries).size, queries.length);
    for (const query of queries) assert.ok(query.length > 0);
  });

  test('the tool-own-terms query is the corpus name itself', () => {
    const own = asked('own-terms');
    assert.equal(own.input, own.response.topic);
  });

  test('the translation query is asked in the terms of a tool already known', () => {
    const translation = asked('translation');
    assert.notEqual(translation.input, translation.response.topic);
    assert.equal(typeof translation.vocabulary.known_tool, 'string');
    assert.ok(
      translation.vocabulary.known_tool.length > 0,
      'a translation lookup names the tool the agent already knows',
    );
  });

  test('only the translation vocabulary names a known tool', () => {
    for (const kind of ['own-terms', 'task']) {
      assert.ok(!('known_tool' in asked(kind).vocabulary), `${kind} names a known tool`);
    }
  });

  test('the task query is task language, not a topic name', () => {
    const task = asked('task');
    assert.match(task.input, /^how /);
    assert.notEqual(task.input, task.response.topic);
  });

  test('all three vocabularies resolve to the identical topic', () => {
    const [head, ...rest] = fixture().steps.map((s) => s.response);
    for (const response of rest) assert.deepEqual(response, head);
  });

  test('the answered topic is one the index advertises', () => {
    const topic = fixture().steps[0].response.topic;
    assert.ok(kitIndex().topics.includes(topic), `the index does not carry ${topic}`);
  });
});

describe('did-you-mean, on both channels', () => {
  const fixture = () => fixtureNamed('did-you-mean.json');

  test('both did-you-mean channels are exercised: accepts and nearest', () => {
    const fields = fixture().steps.map((s) => s.did_you_mean.field);
    assert.deepEqual([...fields].sort(), ['accepts', 'nearest']);
  });

  test('the twin channel carries the alternatives in accepts (RFC 5.1.1)', () => {
    const step = fixture().steps.find((s) => s.did_you_mean.field === 'accepts');
    assert.equal(step.shape, 'twin.schema.json');
    assert.deepEqual(step.response.accepts, step.did_you_mean.candidates);
    assert.equal(step.response.received, step.did_you_mean.received);
  });

  test('the docs channel carries the alternatives in nearest (RFC 5.2.3)', () => {
    const step = fixture().steps.find((s) => s.did_you_mean.field === 'nearest');
    assert.equal(step.shape, 'undocumented.schema.json');
    assert.deepEqual(step.response.nearest, step.did_you_mean.candidates);
    assert.equal(step.response.query, step.did_you_mean.received);
  });

  test('every channel names at least one candidate and never the input itself', () => {
    for (const step of fixture().steps) {
      const { candidates, received } = step.did_you_mean;
      assert.ok(candidates.length > 0, `${step.step} names no candidate`);
      assert.ok(!candidates.includes(received), 'the near-miss is not its own suggestion');
    }
  });

  test('a docs near-miss suggests topics the index actually carries', () => {
    const step = fixture().steps.find((s) => s.did_you_mean.field === 'nearest');
    for (const candidate of step.response.nearest) {
      assert.ok(kitIndex().topics.includes(candidate), `nearest names an absent topic ${candidate}`);
    }
  });
});

describe('undocumented-source-pass (RFC 5.2.3, 7.5, CC10 [20])', () => {
  const fixture = () => fixtureNamed('undocumented-source-pass.json');

  test('the pass is granted by an UNDOCUMENTED response, and never by anything else', () => {
    const { source_pass, steps } = fixture();
    const grant = steps.find((s) => s.response.query === source_pass.granted_for);
    assert.ok(grant, 'the fixture claims a grant no step issued');
    assert.equal(grant.shape, 'undocumented.schema.json');
    assert.equal(grant.response.source_permitted, true);
  });

  test('the permission is for that one question and does not generalize', () => {
    const { source_pass } = fixture();
    assert.equal(source_pass.generalizes, false);
    assert.equal(source_pass.scope, 'this question only');
    assert.ok(source_pass.permitted_action.length > 0);
    assert.ok(source_pass.still_forbidden.length > 0);
  });

  test('a second unanswered question needs its own grant', () => {
    const { source_pass, steps } = fixture();
    const misses = steps.filter((s) => s.shape === 'undocumented.schema.json');
    assert.ok(misses.length > 1, 'one miss cannot show that the pass is per question');
    const queries = misses.map((s) => s.response.query);
    assert.equal(new Set(queries).size, queries.length);
    for (const miss of misses) assert.equal(miss.response.source_permitted, true);
    assert.ok(queries.includes(source_pass.granted_for));
  });

  test('an answered question grants nothing: the fence stands where docs answers', () => {
    const answered = fixture().steps.filter((s) => s.shape === 'topic.schema.json');
    assert.ok(answered.length > 0, 'the fixture never shows the fence holding');
    for (const step of answered) {
      assert.ok(!('source_permitted' in step.response), 'a topic never permits a source read');
      assert.ok(step.response.summary.length > 0);
    }
  });

  test('every UNDOCUMENTED in the kit permits source, always true, never absent', () => {
    const misses = stepsOfShape('undocumented.schema.json');
    assert.ok(misses.length > 0);
    for (const { file, step } of misses) {
      assert.equal(step.response.source_permitted, true, file);
      assert.equal(step.response.code, 'UNDOCUMENTED', file);
    }
  });
});

describe('the golden examples are inside the CC5 budgets', () => {
  test('every topic answer in the kit is topic-sized', () => {
    const topics = stepsOfShape('topic.schema.json');
    assert.ok(topics.length > 0);
    for (const { file, step } of topics) {
      const record = measureScope('topic', step.response);
      assert.ok(record.pass, `${file}: topic is ${record.measured} tokens, budget ${record.limit}`);
    }
  });

  test('every index answer in the kit is a menu, not the meal', () => {
    for (const { file, step } of stepsOfShape('index.schema.json')) {
      const record = measureScope('index', step.response);
      assert.ok(record.pass, `${file}: index is ${record.measured} tokens, budget ${record.limit}`);
    }
  });

  test('every priming snippet in the kit fits the CC5 hard cap', () => {
    const entries = stepsOfShape('entry.schema.json');
    assert.ok(entries.length > 0);
    for (const { file, step } of entries) {
      const record = measureScope('priming', step.response.priming);
      assert.ok(record.pass, `${file}: priming is ${record.measured} tokens, cap ${record.limit}`);
    }
  });
});
