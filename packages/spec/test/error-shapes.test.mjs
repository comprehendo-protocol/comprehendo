// The twinned-errors row of the Protocol Surface table: twin and fix.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { check, without, withField } from './helpers/validate.mjs';
import { FIX, TWIN } from './helpers/rfc-examples.mjs';

describe('twin (RFC §5.1.1)', () => {
  for (const field of ['comprehendo', 'code', 'reason', 'fixes']) {
    test(`rejects a twin missing the REQUIRED field ${field}`, () => {
      assert.equal(check('twin.schema.json', without(TWIN, field)).ok, false);
    });
  }

  for (const field of ['path', 'namespace', 'declared', 'received', 'accepts']) {
    test(`accepts a twin without the OPTIONAL field ${field}`, () => {
      const { ok, errors } = check('twin.schema.json', without(TWIN, field));
      assert.ok(ok, errors);
    });
  }

  test('accepts an empty fixes array (REQUIRED, MAY be empty)', () => {
    const { ok, errors } = check('twin.schema.json', withField(TWIN, 'fixes', []));
    assert.ok(ok, errors);
  });

  test('rejects fixes that is not an array', () => {
    assert.equal(check('twin.schema.json', withField(TWIN, 'fixes', {})).ok, false);
  });

  test('rejects a twin whose fix carries neither apply nor docs', () => {
    const bad = withField(TWIN, 'fixes', [{ title: 'Try something else' }]);
    assert.equal(check('twin.schema.json', bad).ok, false);
  });

  test('rejects accepts entries that are not strings', () => {
    assert.equal(check('twin.schema.json', withField(TWIN, 'accepts', [1])).ok, false);
  });

  test('accepts declared and received of any JSON type (RFC types them unknown)', () => {
    for (const value of [null, 42, 'text', { nested: true }, ['a']]) {
      const twin = withField(withField(TWIN, 'declared', value), 'received', value);
      const { ok, errors } = check('twin.schema.json', twin);
      assert.ok(ok, errors);
    }
  });
});

describe('fix (RFC §5.1.2)', () => {
  test('rejects a fix with neither apply nor docs', () => {
    assert.equal(check('fix.schema.json', { title: 'Do the thing' }).ok, false);
  });

  test('accepts an apply-only fix', () => {
    const { ok, errors } = check('fix.schema.json', {
      title: 'Rename the stage',
      apply: { $group: { _id: '$k' } },
    });
    assert.ok(ok, errors);
  });

  test('accepts a docs-only fix', () => {
    const { ok, errors } = check('fix.schema.json', {
      title: 'Read up on stages',
      docs: 'aggregation stages',
    });
    assert.ok(ok, errors);
  });

  test('rejects a fix missing title', () => {
    assert.equal(check('fix.schema.json', without(FIX, 'title')).ok, false);
  });

  for (const confidence of ['high', 'likely', 'guess']) {
    test(`accepts confidence "${confidence}"`, () => {
      const { ok, errors } = check(
        'fix.schema.json',
        withField(FIX, 'confidence', confidence),
      );
      assert.ok(ok, errors);
    });
  }

  test('rejects a confidence outside the RFC vocabulary', () => {
    assert.equal(
      check('fix.schema.json', withField(FIX, 'confidence', 'certain')).ok,
      false,
    );
  });

  test('rejects a docs pointer that is not a topic name string', () => {
    assert.equal(check('fix.schema.json', withField(FIX, 'docs', ['a'])).ok, false);
  });
});
