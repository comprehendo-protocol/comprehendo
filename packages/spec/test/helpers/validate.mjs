// Shared assertion helpers for the shape suites. One definition of
// "validate this value against this schema"; nothing re-inlines it.

import { compile, makeValidator } from './shapes.mjs';

/** Validate `value` against `file`, returning `{ ok, errors }`. */
export function check(file, value) {
  const ajv = makeValidator();
  const validate = compile(ajv, file);
  const ok = validate(value);
  return { ok, errors: ajv.errorsText(validate.errors) };
}

/** A copy of `value` with `key` removed. */
export function without(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return copy;
}

/** A copy of `value` with `key` set to `fieldValue`. */
export function withField(value, key, fieldValue) {
  const copy = structuredClone(value);
  copy[key] = fieldValue;
  return copy;
}
