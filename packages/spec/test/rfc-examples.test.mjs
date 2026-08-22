// Acceptance criterion 2: every schema validates the RFC's own worked
// examples (from MDs/comprehendo-spec.md) without modification.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { compile, makeValidator } from './helpers/shapes.mjs';
import { WORKED_EXAMPLES } from './helpers/rfc-examples.mjs';

describe('RFC worked examples', () => {
  for (const example of WORKED_EXAMPLES) {
    test(`${example.name} validates against ${example.file}`, () => {
      const ajv = makeValidator();
      const validate = compile(ajv, example.file);
      const ok = validate(example.value);
      assert.ok(ok, ajv.errorsText(validate.errors, { separator: '\n' }));
    });
  }

  test('the twin example carries its fixes through the fix schema too', () => {
    const ajv = makeValidator();
    const validateFix = compile(ajv, 'fix.schema.json');
    const [twinExample] = WORKED_EXAMPLES;
    for (const fix of twinExample.value.fixes) {
      assert.ok(validateFix(fix), ajv.errorsText(validateFix.errors));
    }
  });
});
