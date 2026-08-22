// Fingerprint Index & Matcher [21], cross-package collision.
//
// The doc's Business Rule: a fingerprint collision across two packages'
// corpora fails the registry build, never silently picks one (Acceptance
// Criteria 3). This is the index BUILDER's own check; Submission Gate [29]
// (Wave 5) wraps it in CI later and is not built here.

import { describe, expect, test } from 'vitest';

describe('a cross-package fingerprint collision fails index construction', () => {
  test('two packages declaring the same fingerprint refuse to build', () => {
    expect.fail('MDD skeleton');
  });

  test('the refusal names both colliding packages, never picks one', () => {
    expect.fail('MDD skeleton');
  });

  test('the refusal names the colliding corpus entry ids and the shared fingerprint', () => {
    expect.fail('MDD skeleton');
  });

  test('every collision is reported, not only the first one found', () => {
    expect.fail('MDD skeleton');
  });
});

describe('a within-package duplicate fingerprint fails construction too', () => {
  test('one package declaring the same fingerprint twice is refused', () => {
    expect.fail('MDD skeleton');
  });
});

describe('what is not a collision stays buildable', () => {
  test('two entries sharing an error class but differing on message pattern build fine', () => {
    expect.fail('MDD skeleton');
  });

  test('the same facets under different fingerprint kinds do not collide', () => {
    expect.fail('MDD skeleton');
  });

  test('the same package re-declaring the identical entry id and facets is idempotent, not a collision', () => {
    expect.fail('MDD skeleton');
  });
});
