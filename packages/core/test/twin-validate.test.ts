// Twin Builder [12], the build-time gate: CC7 [09] schema-bound fixes.
//
// The two rules that fail a BUILD rather than a request: a fix whose `apply`
// expresses an operation the provider never declared, and a fix whose `docs`
// pointer names a topic the corpus index does not carry. The kit's own
// fixtures are run through this same validator in twin-kit.test.ts.

import { describe, expect, test } from 'vitest';

import { applyOperations, createTwinBuilder, TwinCatalogError, validateCatalog } from '../src/twin.js';
import type { ProviderCatalog } from '../src/twin.js';
import { catalog, sortEntry } from './helpers/catalog.js';

describe('a schema-escaping apply fails the build (CC7 [09])', () => {
  const escaping = (): ProviderCatalog =>
    catalog({
      ...sortEntry,
      fixes: [
        ...sortEntry.fixes,
        {
          title: 'Materialize the filtered set into a second collection',
          apply: [{ $match: { status: 'active' } }, { $out: 'analytics.events_hot' }],
          confidence: 'guess',
        },
      ],
    });

  test('the build fails, at builder construction, not at twin-throw time', () => {
    expect(() => createTwinBuilder(escaping())).toThrow(TwinCatalogError);
  });

  test('the violation names the escaping operation and points at the fix', () => {
    const violations = validateCatalog(escaping());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe('CC7');
    expect(violations[0]?.reason).toBe('schema-escaping-fix');
    expect(violations[0]?.locator).toBe('entries[0].fixes[2].apply');
    expect(violations[0]?.message).toContain('$out');
  });

  test('the thrown error carries the violations and names them in its message', () => {
    try {
      createTwinBuilder(escaping());
      expect.unreachable('the escaping catalog must not produce a builder');
    } catch (error) {
      expect(error).toBeInstanceOf(TwinCatalogError);
      const failure = error as TwinCatalogError;
      expect(failure.violations).toHaveLength(1);
      expect(failure.message).toContain('$out');
      expect(failure.message).toContain('CC7');
    }
  });

  test('an apply that is not structured call data is rejected, not waved through', () => {
    const violations = validateCatalog(
      catalog({
        ...sortEntry,
        fixes: [{ title: 'Run this', apply: 'db.dropDatabase()' }],
      }),
    );

    expect(violations.map((violation) => violation.reason)).toEqual(['unvalidatable-apply']);
  });

  test('an empty apply expresses no declared operation and is rejected', () => {
    const violations = validateCatalog(
      catalog({ ...sortEntry, fixes: [{ title: 'Do nothing', apply: [] }] }),
    );

    expect(violations.map((violation) => violation.reason)).toEqual(['empty-apply']);
  });

  test('a fix with neither apply nor docs is not a fix', () => {
    const violations = validateCatalog(
      catalog({ ...sortEntry, fixes: [{ title: 'Trust me' }] }),
    );

    expect(violations.map((violation) => violation.reason)).toEqual(['fix-without-remedy']);
  });

  test('applyOperations reads top-level operator keys, and only those', () => {
    expect(applyOperations([{ $match: { created_at: { $gte: 1 } } }, { $limit: 20 }])).toEqual([
      '$match',
      '$limit',
    ]);
    expect(applyOperations({ $set: { a: 1 } })).toEqual(['$set']);
    expect(applyOperations('rm -rf /')).toBeNull();
    expect(applyOperations(['-i', 'in.mp4'])).toBeNull();
  });

  test('a conforming catalog produces a builder and no violations', () => {
    expect(validateCatalog(catalog(sortEntry))).toEqual([]);
    expect(createTwinBuilder(catalog(sortEntry)).codes).toEqual(['SORT_UNINDEXED_SPILL']);
  });
});

describe('a dangling docs pointer fails the build (CC7 [09])', () => {
  const dangling = (): ProviderCatalog =>
    catalog({
      ...sortEntry,
      fixes: [{ title: 'Read the topic', docs: 'sharded transactions' }],
    });

  test('the build fails and the violation names the missing topic', () => {
    const violations = validateCatalog(dangling());

    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe('CC7');
    expect(violations[0]?.reason).toBe('dangling-docs-pointer');
    expect(violations[0]?.locator).toBe('entries[0].fixes[0].docs');
    expect(violations[0]?.message).toContain('sharded transactions');
    expect(() => createTwinBuilder(dangling())).toThrow(TwinCatalogError);
  });

  test('a pointer that resolves against the corpus index passes', () => {
    expect(
      validateCatalog(
        catalog({ ...sortEntry, fixes: [{ title: 'Read up', docs: 'capped collections' }] }),
      ),
    ).toEqual([]);
  });
});

