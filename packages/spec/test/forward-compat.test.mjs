// Acceptance criterion 3, and RFC §11: within a major, fields are only ever
// added; agents and implementations MUST ignore fields they do not
// recognize. The schemas must therefore accept documents carrying fields
// this version of the spec has never heard of. The forward-compat fixture
// in Conformance Fixtures [04] exercises this against these schemas.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { check, withField } from './helpers/validate.mjs';
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
