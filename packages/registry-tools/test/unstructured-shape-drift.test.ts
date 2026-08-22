// The UNSTRUCTURED shape this package emits is owned elsewhere.
//
// `unstructuredTwin()` in packages/core/src/twin.ts is the source of truth for
// the shape, and Shape Schemas [03] (packages/spec/kit/shapes/twin.schema.json)
// is the source of truth for the required fields. registry-tools is a
// build-time tool with no dependency on core's runtime module, so it carries
// its own copy of the two literals; per the duplication rule, the copy owes a
// test asserting both values match. That is this file.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  buildFingerprintIndex,
  SPEC_VERSION,
  UNSTRUCTURED_CODE,
  UNSTRUCTURED_REASON,
} from '../src/fingerprint.js';
import { CORPUS, caught } from './helpers/corpus.js';

const PACKAGES = join(import.meta.dirname, '..', '..');

const read = (...parts: readonly string[]): string => readFileSync(join(PACKAGES, ...parts), 'utf8');

/** The literal a `export const NAME = '...'` declaration carries in core. */
const literal = (source: string, name: string): string => {
  const found = new RegExp(`export const ${name} =\\s*'([^']*)'`).exec(source);
  expect(found, `core no longer declares ${name} as a single-quoted literal`).not.toBeNull();
  return found?.[1] ?? '';
};

describe('the emitted UNSTRUCTURED twin does not drift from core', () => {
  test('the code and reason literals match packages/core/src/twin-validate.ts verbatim', () => {
    const core = read('core', 'src', 'twin-validate.ts');

    expect(UNSTRUCTURED_CODE).toBe(literal(core, 'UNSTRUCTURED_CODE'));
    expect(UNSTRUCTURED_REASON).toBe(literal(core, 'UNSTRUCTURED_REASON'));
  });

  test('the spec version matches packages/core/src/twin.ts', () => {
    const core = read('core', 'src', 'twin.ts');

    expect(SPEC_VERSION).toBe(literal(core, 'SPEC_VERSION'));
    // The shape itself: core's unstructuredTwin carries the code, the reason,
    // the raw error in received, and no fix.
    expect(core).toContain('code: UNSTRUCTURED_CODE');
    expect(core).toContain('reason: UNSTRUCTURED_REASON');
    expect(core).toContain("...present('received', receivedOf(raw))");
    expect(core).toContain('fixes: [],');
  });

  test('the emitted twin carries every field twin.schema.json requires', () => {
    const schema = JSON.parse(read('spec', 'kit', 'shapes', 'twin.schema.json')) as {
      required: readonly string[];
    };
    const result = buildFingerprintIndex(CORPUS).match(caught('NoSuchError', 'nothing cataloged'));

    if (result.outcome === 'matched') return expect.unreachable('this input is not cataloged');
    const fields = Object.keys(result.twin);
    for (const required of schema.required) expect(fields).toContain(required);
    // An UNSTRUCTURED twin without `received` is a CC3 [08] violation in core's
    // own validator, so it is required here too, schema or not.
    expect(fields).toContain('received');
    expect(result.twin.comprehendo).toBe(SPEC_VERSION);
  });
});
