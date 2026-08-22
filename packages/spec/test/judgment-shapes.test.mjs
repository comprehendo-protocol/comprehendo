// The validate(input) and explain(input) rows of the Protocol Surface
// table: the Level 2 shapes.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { check, without, withField } from './helpers/validate.mjs';
import { EXPLANATION, UNVALIDATABLE } from './helpers/rfc-examples.mjs';

describe('UNVALIDATABLE (RFC §5.3.2)', () => {
  test('requires valid to be null, never a guess in either direction', () => {
    for (const guess of [true, false]) {
      assert.equal(
        check('unvalidatable.schema.json', withField(UNVALIDATABLE, 'valid', guess)).ok,
        false,
      );
    }
  });

  test('rejects a code other than UNVALIDATABLE', () => {
    assert.equal(
      check('unvalidatable.schema.json', withField(UNVALIDATABLE, 'code', 'UNKNOWN')).ok,
      false,
    );
  });

  test('rejects UNVALIDATABLE missing reason', () => {
    assert.equal(
      check('unvalidatable.schema.json', without(UNVALIDATABLE, 'reason')).ok,
      false,
    );
  });
});

describe('explanation (RFC §5.4)', () => {
  test('rejects an explanation missing would_execute', () => {
    assert.equal(
      check('explanation.schema.json', without(EXPLANATION, 'would_execute')).ok,
      false,
    );
  });

  test('accepts a would_execute that is a command line string', () => {
    const { ok, errors } = check('explanation.schema.json', {
      would_execute: 'ffmpeg -i in.mp4 -vf crop=640:480 out.mp4',
    });
    assert.ok(ok, errors);
  });

  test('rejects notes that are not strings', () => {
    assert.equal(
      check('explanation.schema.json', withField(EXPLANATION, 'notes', [{ a: 1 }])).ok,
      false,
    );
  });
});
