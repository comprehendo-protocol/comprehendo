// Fingerprint Index & Matcher [21], index construction.
//
// The doc's Business Rule: the index is static, built once at registry build
// time, never mutated at runtime, no learning from live traffic. These tests
// hold the builder to "deterministic from a corpus's declared fingerprints"
// (Acceptance Criteria 1) and to the frozen, no-learning shape.

import { describe, expect, test } from 'vitest';

describe('the index builds deterministically from declared fingerprints', () => {
  test('the same entries in a different input order produce an identical artifact', () => {
    expect.fail('MDD skeleton');
  });

  test('serializing and parsing the artifact round-trips to an equal index', () => {
    expect.fail('MDD skeleton');
  });
});

describe('the index is static: compiled once, never learned', () => {
  test('the built index and its entries are frozen', () => {
    expect.fail('MDD skeleton');
  });

  test('matching against the index never mutates it, however many misses it sees', () => {
    expect.fail('MDD skeleton');
  });
});

describe('a corpus entry that cannot fingerprint anything fails construction', () => {
  test('an entry declaring no error class, no message pattern and no stack shape is refused', () => {
    expect.fail('MDD skeleton');
  });

  test('an entry with an empty package or corpus entry id is refused', () => {
    expect.fail('MDD skeleton');
  });

  test('a malformed serialized artifact is refused on parse, never partially loaded', () => {
    expect.fail('MDD skeleton');
  });
});
