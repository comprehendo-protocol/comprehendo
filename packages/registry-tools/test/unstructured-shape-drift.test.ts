// The UNSTRUCTURED shape this package emits is owned elsewhere.
//
// `unstructuredTwin()` in packages/core/src/twin.ts is the source of truth for
// the shape, and Shape Schemas [03] (packages/spec/kit/shapes/twin.schema.json)
// is the source of truth for the required fields. registry-tools is a
// build-time tool with no dependency on core's runtime module, so it carries
// its own copy of the two literals; per the duplication rule, the copy owes a
// test asserting both values match. That is this file.

import { describe, expect, test } from 'vitest';

describe('the emitted UNSTRUCTURED twin does not drift from core', () => {
  test('the code and reason literals match packages/core/src/twin-validate.ts verbatim', () => {
    expect.fail('MDD skeleton');
  });

  test('the spec version matches packages/core/src/twin.ts', () => {
    expect.fail('MDD skeleton');
  });

  test('the emitted twin carries every field twin.schema.json requires', () => {
    expect.fail('MDD skeleton');
  });
});
