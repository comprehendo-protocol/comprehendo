// The normative constraints the schemas exist to enforce, and the
// forward-compatibility guarantee they must NOT violate.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { compile, makeValidator } from './helpers/shapes.mjs';
import {
  CONFIG,
  ENTRY,
  EXPLANATION,
  FIX,
  INDEX,
  MANIFEST,
  TOPIC,
  TWIN,
  UNDOCUMENTED,
  UNVALIDATABLE,
} from './helpers/rfc-examples.mjs';

/** Validate `value` against `file`, returning `{ ok, errors }`. */
function check(file, value) {
  const ajv = makeValidator();
  const validate = compile(ajv, file);
  const ok = validate(value);
  return { ok, errors: ajv.errorsText(validate.errors) };
}

function without(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return copy;
}

function withField(value, key, fieldValue) {
  const copy = structuredClone(value);
  copy[key] = fieldValue;
  return copy;
}

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

describe('UNDOCUMENTED (RFC §5.2.3)', () => {
  for (const field of [
    'comprehendo',
    'code',
    'query',
    'nearest',
    'source_permitted',
  ]) {
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
    assert.equal(check('manifest.schema.json', withField(MANIFEST, 'level', '2')).ok, false);
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

// Acceptance criterion 3, and RFC §11: within a major, fields are only ever
// added; agents and implementations MUST ignore fields they do not
// recognize. The schemas must therefore accept documents carrying fields
// this version of the spec has never heard of.
describe('forward compatibility (RFC §11)', () => {
  const unknown = {
    severity: 'fatal',
    retryable: false,
    telemetry_hint: { anything: ['at', 'all'] },
  };

  const cases = [
    ['twin.schema.json', TWIN],
    ['fix.schema.json', FIX],
    ['topic.schema.json', TOPIC],
    ['index.schema.json', INDEX],
    ['entry.schema.json', ENTRY],
    ['undocumented.schema.json', UNDOCUMENTED],
    ['unvalidatable.schema.json', UNVALIDATABLE],
    ['explanation.schema.json', EXPLANATION],
    ['manifest.schema.json', MANIFEST],
    ['config.schema.json', CONFIG],
  ];

  for (const [file, value] of cases) {
    test(`${file} accepts a document carrying unknown fields`, () => {
      const { ok, errors } = check(file, { ...structuredClone(value), ...unknown });
      assert.ok(ok, errors);
    });
  }

  test('a twin whose fixes carry unknown fields still validates', () => {
    const twin = structuredClone(TWIN);
    twin.fixes[0].blast_radius = 'local';
    const { ok, errors } = check('twin.schema.json', twin);
    assert.ok(ok, errors);
  });

  test('a twin carrying the RFC-mentioned cause field validates', () => {
    const twin = withField(TWIN, 'cause', { name: 'MongoServerError' });
    const { ok, errors } = check('twin.schema.json', twin);
    assert.ok(ok, errors);
  });
});
