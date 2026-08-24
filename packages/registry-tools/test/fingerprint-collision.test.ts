// Fingerprint Index & Matcher [21], cross-package collision.
//
// The doc's Business Rule: a fingerprint collision across two packages'
// corpora fails the registry build, never silently picks one (Acceptance
// Criteria 3). This is the index BUILDER's own check; Submission Gate [29]
// (Wave 5) wraps it in CI later and is not built here.

import { describe, expect, test } from 'vitest';

import {
  buildFingerprintIndex,
  buildStaticPatternIndex,
  FingerprintCollisionError,
  FingerprintIndexError,
  type FingerprintEntry,
} from '../src/fingerprint.js';
import { CORPUS, UNKNOWN_ENCODER } from './helpers/corpus.js';

/** CORPUS's own runtime-error count: every entry except ZOD_PARSE_UNGUARDED. */
const RUNTIME_ERROR_COUNT = CORPUS.filter((entry) => (entry.kind ?? 'runtime-error') === 'runtime-error').length;

/** The same fingerprint UNKNOWN_ENCODER declares, in another package's corpus. */
const SQUATTER: FingerprintEntry = {
  package: '@comprehendo/avconv',
  errorClass: 'FFmpegError',
  messagePattern: "Unknown encoder '*'",
  corpusEntryId: 'UNKNOWN_CODEC',
};

const collisionFrom = (entries: readonly unknown[]): FingerprintCollisionError => {
  try {
    buildFingerprintIndex(entries);
  } catch (error) {
    if (error instanceof FingerprintCollisionError) return error;
    throw error;
  }
  return expect.unreachable('the index must refuse to build on a fingerprint collision');
};

describe('a cross-package fingerprint collision fails index construction', () => {
  test('two packages declaring the same fingerprint refuse to build', () => {
    expect(() => buildFingerprintIndex([...CORPUS, SQUATTER])).toThrow(FingerprintCollisionError);
  });

  test('the refusal names both colliding packages, never picks one', () => {
    const error = collisionFrom([...CORPUS, SQUATTER]);

    expect(error.collisions).toHaveLength(1);
    expect(error.collisions[0]?.packages).toEqual(['@comprehendo/avconv', '@comprehendo/ffmpeg']);
    expect(error.collisions[0]?.crossPackage).toBe(true);
    expect(error.message).toContain('@comprehendo/avconv');
    expect(error.message).toContain('@comprehendo/ffmpeg');
    expect(error.message).toContain('never picks one');
  });

  test('the refusal names the colliding corpus entry ids and the shared fingerprint', () => {
    const error = collisionFrom([...CORPUS, SQUATTER]);

    expect(error.collisions[0]?.entries).toEqual([
      '@comprehendo/avconv#UNKNOWN_CODEC',
      '@comprehendo/ffmpeg#UNKNOWN_ENCODER',
    ]);
    expect(error.collisions[0]?.fingerprint).toContain("Unknown encoder '*'");
  });

  test('every collision is reported, not only the first one found', () => {
    const second: FingerprintEntry = {
      package: '@comprehendo/graphicsmagick',
      errorClass: 'MagickError',
      messagePattern: "no decode delegate for this image format '*'",
      corpusEntryId: 'NO_DELEGATE',
    };
    const error = collisionFrom([...CORPUS, SQUATTER, second]);

    expect(error.collisions).toHaveLength(2);
    expect(error.message).toContain('2 collision(s)');
    expect(error.collisions.flatMap((collision) => collision.packages)).toContain(
      '@comprehendo/graphicsmagick',
    );
  });
});

describe('a within-package duplicate fingerprint fails construction too', () => {
  test('one package declaring the same fingerprint twice is refused', () => {
    const error = collisionFrom([
      ...CORPUS,
      { ...UNKNOWN_ENCODER, corpusEntryId: 'UNKNOWN_ENCODER_V2' },
    ]);

    expect(error.collisions[0]?.crossPackage).toBe(false);
    expect(error.collisions[0]?.entries).toEqual([
      '@comprehendo/ffmpeg#UNKNOWN_ENCODER',
      '@comprehendo/ffmpeg#UNKNOWN_ENCODER_V2',
    ]);
  });
});

describe('what is not a collision stays buildable', () => {
  test('two entries sharing an error class but differing on message pattern build fine', () => {
    const index = buildFingerprintIndex([
      ...CORPUS,
      { ...SQUATTER, messagePattern: "Unknown decoder '*'" },
    ]);

    expect(index.entries).toHaveLength(RUNTIME_ERROR_COUNT + 1);
  });

  // Fixed: the same facets under different kinds used to coexist in ONE
  // shared index (filtered at match time); now each kind gets its own
  // index (`buildIndexOfKind`), so identical facets under different kinds
  // are never even compared for collision, they simply never occupy the
  // same index. Proven both directions: the runtime-error index excludes
  // the static-pattern variant entirely, and the static-pattern index
  // builds it cleanly on its own, colliding with nothing (CORPUS's one
  // static-pattern entry, ZOD_PARSE_UNGUARDED, declares different facets).
  test('the same facets under different fingerprint kinds never even share an index', () => {
    const entries = [...CORPUS, { ...SQUATTER, kind: 'static-pattern' as const }];

    const runtimeIndex = buildFingerprintIndex(entries);
    expect(runtimeIndex.entries).toHaveLength(RUNTIME_ERROR_COUNT);
    expect(runtimeIndex.entries.some((entry) => entry.package === SQUATTER.package)).toBe(false);

    const patternIndex = buildStaticPatternIndex(entries);
    expect(patternIndex.entries).toHaveLength(2);
    expect(patternIndex.entries.some((entry) => entry.package === SQUATTER.package)).toBe(true);
  });

  test('the same package re-declaring the identical entry id and facets is idempotent, not a collision', () => {
    const index = buildFingerprintIndex([...CORPUS, { ...UNKNOWN_ENCODER }]);

    expect(index.entries).toHaveLength(RUNTIME_ERROR_COUNT);
  });
});

describe('two entries sharing an id but disagreeing on facets refuse to build', () => {
  // Found by review: this used to fall through both the id-based dedup
  // (Map keyed by package#corpusEntryId, last write wins) and the
  // signature-based collision check (they're in different signature
  // buckets, since the facets differ), so one entry vanished silently and
  // order-dependently instead of failing the build. Same defect class as
  // any other "two entries, one identity" case this feature refuses.
  test('the SAME corpusEntryId with a DIFFERENT errorClass refuses to build, naming the id', () => {
    const conflicting = [...CORPUS, { ...UNKNOWN_ENCODER, errorClass: 'SomethingElseError' }];

    expect(() => buildFingerprintIndex(conflicting)).toThrow(FingerprintIndexError);
    try {
      buildFingerprintIndex(conflicting);
      expect.unreachable('must refuse');
    } catch (error) {
      expect(error).toBeInstanceOf(FingerprintIndexError);
      const detail = (error as FingerprintIndexError).defects.map((d) => d.detail).join('\n');
      expect(detail).toContain(UNKNOWN_ENCODER.corpusEntryId);
      expect(detail).toMatch(/different fingerprint/i);
    }
  });

  test('never silently keeps whichever declaration happened to come last', () => {
    // The exact live repro from review: with the conflicting declaration
    // FIRST, the old code kept the later (correct) one and looked fine;
    // proving the refusal is order-independent is the point.
    const conflicting = [{ ...UNKNOWN_ENCODER, errorClass: 'SomethingElseError' }, ...CORPUS];

    expect(() => buildFingerprintIndex(conflicting)).toThrow(FingerprintIndexError);
  });
});
