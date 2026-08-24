// Fingerprint Index & Matcher [21], index construction.
//
// The doc's Business Rule: the index is static, built once at registry build
// time, never mutated at runtime, no learning from live traffic. These tests
// hold the builder to "deterministic from a corpus's declared fingerprints"
// (Acceptance Criteria 1) and to the frozen, no-learning shape.

import { describe, expect, test } from 'vitest';

import {
  buildFingerprintIndex,
  FingerprintIndexError,
  parseFingerprintIndex,
  serializeIndex,
} from '../src/fingerprint.js';
import { CORPUS, caught } from './helpers/corpus.js';

/** CORPUS's own runtime-error count: every entry except ZOD_PARSE_UNGUARDED. */
const RUNTIME_ERROR_COUNT = CORPUS.filter((entry) => (entry.kind ?? 'runtime-error') === 'runtime-error').length;

describe('the index builds deterministically from declared fingerprints', () => {
  test('the same entries in a different input order produce an identical artifact', () => {
    const forward = serializeIndex(buildFingerprintIndex(CORPUS));
    const backward = serializeIndex(buildFingerprintIndex([...CORPUS].reverse()));
    const shuffled = serializeIndex(
      buildFingerprintIndex([CORPUS[3], CORPUS[0], CORPUS[5], CORPUS[1], CORPUS[4], CORPUS[2]]),
    );

    expect(forward).toBe(backward);
    expect(forward).toBe(shuffled);
    expect(forward).toContain('@comprehendo/ffmpeg');
  });

  test('serializing and parsing the artifact round-trips to an equal index', () => {
    const built = buildFingerprintIndex(CORPUS);
    const reloaded = parseFingerprintIndex(serializeIndex(built));

    expect(reloaded.entries).toEqual(built.entries);
    expect(serializeIndex(reloaded)).toBe(serializeIndex(built));
  });
});

describe('the index is static: compiled once, never learned', () => {
  test('the built index and its entries are frozen', () => {
    const index = buildFingerprintIndex(CORPUS);

    expect(Object.isFrozen(index)).toBe(true);
    expect(Object.isFrozen(index.entries)).toBe(true);
    expect(index.entries.every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(() => {
      (index.entries as unknown[]).push({ package: 'x', corpusEntryId: 'y' });
    }).toThrow(TypeError);
  });

  test('matching against the index never mutates it, however many misses it sees', () => {
    const index = buildFingerprintIndex(CORPUS);
    const before = serializeIndex(index);

    for (let i = 0; i < 200; i += 1) {
      index.match(caught('SomeError', `a failure nobody cataloged, number ${i}`));
    }

    expect(serializeIndex(index)).toBe(before);
    expect(index.entries).toHaveLength(RUNTIME_ERROR_COUNT);
  });
});

describe('a corpus entry that cannot fingerprint anything fails construction', () => {
  test('an entry declaring no error class, no message pattern and no stack shape is refused', () => {
    expect(() =>
      buildFingerprintIndex([...CORPUS, { package: '@comprehendo/curl', corpusEntryId: 'ANY' }]),
    ).toThrow(FingerprintIndexError);

    try {
      buildFingerprintIndex([{ package: '@comprehendo/curl', corpusEntryId: 'ANY' }]);
      expect.unreachable('an entry with no facet must refuse to compile');
    } catch (error) {
      expect(error).toBeInstanceOf(FingerprintIndexError);
      expect((error as FingerprintIndexError).defects[0]?.detail).toContain(
        'no errorClass, no messagePattern and no stackShape',
      );
    }
  });

  test('an entry with an empty package or corpus entry id is refused', () => {
    const defectsOf = (entry: unknown): readonly string[] => {
      try {
        buildFingerprintIndex([entry]);
        return [];
      } catch (error) {
        return (error as FingerprintIndexError).defects.map((defect) => defect.detail);
      }
    };

    expect(defectsOf({ package: '  ', corpusEntryId: 'A', errorClass: 'Error' })).toContain(
      'package is missing or empty',
    );
    expect(defectsOf({ package: '@comprehendo/x', corpusEntryId: '', errorClass: 'Error' })).toContain(
      'corpusEntryId is missing or empty',
    );
    expect(
      defectsOf({ package: '@comprehendo/x', corpusEntryId: 'A', stackShape: [] }),
    ).toContain('stackShape is present but is not a non-empty list of frame markers');
    expect(defectsOf({ package: '@comprehendo/x', corpusEntryId: 'A', kind: 'learned' })).toContain(
      'kind "learned" is not a fingerprint kind',
    );
  });

  test('a malformed serialized artifact is refused on parse, never partially loaded', () => {
    expect(() => parseFingerprintIndex('{ not json')).toThrow(FingerprintIndexError);
    expect(() => parseFingerprintIndex('{"comprehendo":"0.1"}')).toThrow(FingerprintIndexError);
    expect(() => parseFingerprintIndex('{"fingerprints":[{"package":"@comprehendo/x"}]}')).toThrow(
      FingerprintIndexError,
    );
  });
});
