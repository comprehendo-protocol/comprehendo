// The identity + priming row of the Protocol Surface table (the entry and
// the manifest declaration), plus the consumer-side configuration knobs.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { check, without, withField } from './helpers/validate.mjs';
import { CONFIG, ENTRY, MANIFEST } from './helpers/rfc-examples.mjs';

describe('entry (RFC §4.2)', () => {
  for (const field of [
    'comprehendo',
    'name',
    'level',
    'surfaces',
    'identity',
    'priming',
  ]) {
    test(`rejects an entry missing REQUIRED field ${field}`, () => {
      assert.equal(check('entry.schema.json', without(ENTRY, field)).ok, false);
    });
  }

  for (const level of [1, 2]) {
    test(`accepts conformance level ${level}`, () => {
      const { ok, errors } = check('entry.schema.json', withField(ENTRY, 'level', level));
      assert.ok(ok, errors);
    });
  }

  test('rejects a conformance level the RFC does not define', () => {
    assert.equal(check('entry.schema.json', withField(ENTRY, 'level', 3)).ok, false);
  });

  test('rejects a surface outside the callable vocabulary', () => {
    const bad = withField(ENTRY, 'surfaces', ['docs', 'twinned errors']);
    assert.equal(check('entry.schema.json', bad).ok, false);
  });

  test('accepts the optional comprehend surface (RFC §5.1.6)', () => {
    const entry = withField(ENTRY, 'surfaces', ['docs', 'comprehend']);
    const { ok, errors } = check('entry.schema.json', entry);
    assert.ok(ok, errors);
  });

  // RFC §3: a provider that cannot judge without executing MUST omit
  // validate rather than fake it. Schema-level, that means validate is
  // optional and never present-but-null: surfaces is a list of what exists.
  test('accepts a Level 1 entry that omits validate and explain entirely', () => {
    const level1 = withField(withField(ENTRY, 'level', 1), 'surfaces', ['docs']);
    const { ok, errors } = check('entry.schema.json', level1);
    assert.ok(ok, errors);
  });

  test('rejects a null placeholder in surfaces instead of an omission', () => {
    const bad = withField(ENTRY, 'surfaces', ['docs', null]);
    assert.equal(check('entry.schema.json', bad).ok, false);
  });
});

describe('manifest keys (RFC §4.3)', () => {
  for (const field of ['version', 'level']) {
    test(`rejects a manifest missing ${field}`, () => {
      assert.equal(check('manifest.schema.json', without(MANIFEST, field)).ok, false);
    });
  }

  test('rejects a manifest level the RFC does not define', () => {
    assert.equal(check('manifest.schema.json', withField(MANIFEST, 'level', 0)).ok, false);
  });

  test('rejects a level given as a string', () => {
    assert.equal(
      check('manifest.schema.json', withField(MANIFEST, 'level', '2')).ok,
      false,
    );
  });
});

describe('consumer config knobs (RFC §10.5)', () => {
  test('accepts an empty config (the default requires no configuration)', () => {
    const { ok, errors } = check('config.schema.json', {});
    assert.ok(ok, errors);
  });

  for (const knob of ['prefer', 'pin', 'disable', 'require', 'local']) {
    test(`accepts ${knob} on its own (every knob is optional)`, () => {
      const { ok, errors } = check('config.schema.json', { [knob]: CONFIG[knob] });
      assert.ok(ok, errors);
    });
  }

  test('rejects disable given as an object instead of a list', () => {
    assert.equal(
      check('config.schema.json', withField(CONFIG, 'disable', { pkg: true })).ok,
      false,
    );
  });

  test('rejects a pin whose version is not a string', () => {
    assert.equal(
      check('config.schema.json', withField(CONFIG, 'pin', { pkg: 142 })).ok,
      false,
    );
  });
});
