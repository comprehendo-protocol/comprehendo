// The docs(query?) row of the Protocol Surface table: index, topic, and the
// UNDOCUMENTED gate.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { check, without, withField } from './helpers/validate.mjs';
import { INDEX, TOPIC, UNDOCUMENTED } from './helpers/rfc-examples.mjs';

describe('topic and index (RFC §5.2.1, §5.2.2)', () => {
  for (const field of ['topic', 'summary']) {
    test(`rejects a topic missing ${field}`, () => {
      assert.equal(check('topic.schema.json', without(TOPIC, field)).ok, false);
    });
  }

  test('rejects an example missing code', () => {
    const bad = withField(TOPIC, 'examples', [{ title: 'Group by key' }]);
    assert.equal(check('topic.schema.json', bad).ok, false);
  });

  test('rejects an index missing topics', () => {
    assert.equal(check('index.schema.json', without(INDEX, 'topics')).ok, false);
  });

  test('accepts an empty index (a corpus may answer nothing yet)', () => {
    const { ok, errors } = check('index.schema.json', { topics: [] });
    assert.ok(ok, errors);
  });

  test('rejects an index of topic objects (the index is names only)', () => {
    const bad = { topics: [{ topic: 'aggregation stages', summary: 'the meal' }] };
    assert.equal(check('index.schema.json', bad).ok, false);
  });
});

describe('UNDOCUMENTED (RFC §5.2.3)', () => {
  for (const field of ['comprehendo', 'code', 'query', 'nearest', 'source_permitted']) {
    test(`rejects UNDOCUMENTED missing REQUIRED field ${field}`, () => {
      assert.equal(
        check('undocumented.schema.json', without(UNDOCUMENTED, field)).ok,
        false,
      );
    });
  }

  test('rejects source_permitted: false (the RFC says always true)', () => {
    assert.equal(
      check(
        'undocumented.schema.json',
        withField(UNDOCUMENTED, 'source_permitted', false),
      ).ok,
      false,
    );
  });

  test('rejects a code other than UNDOCUMENTED', () => {
    assert.equal(
      check('undocumented.schema.json', withField(UNDOCUMENTED, 'code', 'MISSING')).ok,
      false,
    );
  });

  test('accepts an empty nearest array (did-you-mean MAY be empty)', () => {
    const { ok, errors } = check(
      'undocumented.schema.json',
      withField(UNDOCUMENTED, 'nearest', []),
    );
    assert.ok(ok, errors);
  });
});
