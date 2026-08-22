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

describe('an empty reason fails the build (CATALOG)', () => {
  test('a whitespace-only reason is rejected, symmetric with fix-without-title', () => {
    const violations = validateCatalog(catalog({ ...sortEntry, reason: '   ' }));

    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe('CATALOG');
    expect(violations[0]?.reason).toBe('empty-reason');
    expect(() => createTwinBuilder(catalog({ ...sortEntry, reason: '' }))).toThrow(
      TwinCatalogError,
    );
  });
});

describe('a raw error pasted straight into reason fails the build (CC3 [08])', () => {
  test('reason containing the entry-authored received text is rejected at catalog time', () => {
    const raw = 'Sort exceeded memory limit of 33554432 bytes';
    const violations = validateCatalog(
      catalog({ ...sortEntry, reason: raw, received: raw }),
    );

    expect(violations.some((v) => v.rule === 'CC3' && v.reason === 'raw-error-leak')).toBe(true);
    expect(() =>
      createTwinBuilder(catalog({ ...sortEntry, reason: raw, received: raw })),
    ).toThrow(TwinCatalogError);
  });

  test('reason that only PARAPHRASES received (does not contain it verbatim) passes', () => {
    // The check is substring containment of the raw text, not "a reason
    // exists alongside received"; an author-written explanation that
    // merely describes the same failure must not be flagged.
    const violations = validateCatalog(
      catalog({
        ...sortEntry,
        reason: 'The sort has no supporting index.',
        received: 'Sort exceeded memory limit of 33554432 bytes',
      }),
    );

    expect(violations.filter((v) => v.reason === 'raw-error-leak')).toEqual([]);
  });
});

describe('CC7 recurses into a declared nesting operation, never into operand data', () => {
  const schemaWithFacet = {
    surface: 'aggregate(pipeline)',
    operations: ['$match', '$facet', '$lookup'],
    nestedPipelineOperations: ['$facet', '$lookup'],
  };

  const nested = (apply: unknown): ProviderCatalog => ({
    declaredSchema: schemaWithFacet,
    topics: [],
    entries: [
      {
        ...sortEntry,
        fixes: [{ title: 'Nested', apply, confidence: 'guess' }],
      },
    ],
  });

  test('a write stage smuggled inside a $facet branch is caught', () => {
    const violations = validateCatalog(
      nested([{ $facet: { catA: [{ $match: {} }, { $merge: { into: 'x' } }] } }]),
    );

    expect(
      violations.some((v) => v.reason === 'schema-escaping-fix' && v.message.includes('$merge')),
    ).toBe(true);
  });

  test('a write stage smuggled inside a $lookup.pipeline is caught', () => {
    const violations = validateCatalog(
      nested([{ $lookup: { from: 'x', pipeline: [{ $merge: { into: 'y' } }] } }]),
    );

    expect(
      violations.some((v) => v.reason === 'schema-escaping-fix' && v.message.includes('$merge')),
    ).toBe(true);
  });

  test('a conforming nested pipeline passes', () => {
    expect(
      validateCatalog(nested([{ $facet: { catA: [{ $match: {} }] } }])),
    ).toEqual([]);
  });

  test('operand keys inside a NON-nesting operator (e.g. a $match filter) are never scanned as operations', () => {
    // $match's filter is a plain operand document, not declared as a
    // nesting operation; its field names must never be checked against
    // the declared operations list.
    const violations = validateCatalog(
      nested([{ $match: { $or: [{ region: 'eu' }, { region: 'us' }] } }]),
    );

    expect(violations).toEqual([]);
  });
});

