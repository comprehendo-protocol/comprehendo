// Fingerprint Index & Matcher [21], cross-package collision.
//
// The doc's Business Rule: a fingerprint collision across two packages'
// corpora fails the registry build, never silently picks one (Acceptance
// Criteria 3). This is the index BUILDER's own check; Submission Gate [29]
// (Wave 5) wraps it in CI later and is not built here.

import { describe, expect, test } from 'vitest';

import {
  buildFingerprintIndex,
  FingerprintCollisionError,
  type FingerprintEntry,
} from '../src/fingerprint.js';
import { CORPUS, UNKNOWN_ENCODER } from './helpers/corpus.js';

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

    expect(index.entries).toHaveLength(7);
  });

  test('the same facets under different fingerprint kinds do not collide', () => {
    const index = buildFingerprintIndex([
      ...CORPUS,
      { ...SQUATTER, kind: 'static-pattern' as const },
    ]);

    expect(index.entries).toHaveLength(7);
  });

  test('the same package re-declaring the identical entry id and facets is idempotent, not a collision', () => {
    const index = buildFingerprintIndex([...CORPUS, { ...UNKNOWN_ENCODER }]);

    expect(index.entries).toHaveLength(6);
  });
});
