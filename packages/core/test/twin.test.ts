// Twin Builder [12], unit behaviour.
//
// The kit fixtures are the acceptance criteria and are run through the real
// validator in twin-kit.test.ts; this file covers the surface the doc names
// (`err.twin`) and the four build-time rules around it.

import { describe, expect, test } from 'vitest';

import {
  applyOperations,
  attachTwin,
  COMPREHENDO_MARKER,
  createTwinBuilder,
  SPEC_VERSION,
  TwinCatalogError,
  unstructuredTwin,
  validateCatalog,
} from '../src/twin.js';
import type { CatalogEntry, ProviderCatalog } from '../src/twin.js';

/** The provider's declared call surface, same shape the negative kit declares. */
const declaredSchema = {
  surface: 'aggregate(pipeline)',
  operations: ['$match', '$sort', '$limit', '$project', '$group', '$count'],
} as const;

const topics = ['index selection', 'capped collections'] as const;

const sortEntry: CatalogEntry = {
  code: 'SORT_UNINDEXED_SPILL',
  reason:
    'The sort at pipeline[1] has no index to satisfy it, so it would buffer the whole matched set in memory.',
  path: 'pipeline[1].$sort',
  namespace: 'analytics.events',
  fixes: [
    {
      title: 'Sort on the indexed field the pipeline already filters on',
      apply: [{ $match: { status: 'active' } }, { $sort: { status: 1, created_at: -1 } }],
      docs: 'index selection',
      confidence: 'high',
    },
    {
      title: 'Narrow the match before sorting, so the sort fits the memory ceiling',
      apply: [{ $match: { status: 'active' } }, { $limit: 20 }],
      confidence: 'likely',
    },
  ],
};

const catalog = (...entries: CatalogEntry[]): ProviderCatalog => ({
  declaredSchema,
  topics: [...topics],
  entries,
});

const RAW = 'Sort exceeded memory limit of 33554432 bytes';

describe('a cataloged failure becomes a twin', () => {
  test('build() returns the twin shape with the spec version and the entry fields', () => {
    const twin = createTwinBuilder(catalog(sortEntry)).build('SORT_UNINDEXED_SPILL');

    expect(twin.comprehendo).toBe(SPEC_VERSION);
    expect(twin.code).toBe('SORT_UNINDEXED_SPILL');
    expect(twin.reason).toBe(sortEntry.reason);
    expect(twin.path).toBe('pipeline[1].$sort');
    expect(twin.namespace).toBe('analytics.events');
    expect(twin.fixes).toHaveLength(2);
  });

  test('fixes keep the corpus author order, most-likely-first, never re-sorted', () => {
    const twin = createTwinBuilder(catalog(sortEntry)).build('SORT_UNINDEXED_SPILL');

    expect(twin.fixes.map((fix) => fix.title)).toEqual([
      'Sort on the indexed field the pipeline already filters on',
      'Narrow the match before sorting, so the sort fits the memory ceiling',
    ]);
    expect(twin.fixes[0]?.confidence).toBe('high');
  });

  test('throw-site context fills received and overrides the catalog fields', () => {
    const twin = createTwinBuilder(catalog(sortEntry)).build('SORT_UNINDEXED_SPILL', {
      received: 'a sort on created_at, which no index covers',
      namespace: 'analytics.events_2026',
    });

    expect(twin.received).toBe('a sort on created_at, which no index covers');
    expect(twin.namespace).toBe('analytics.events_2026');
  });

  test('the twin is frozen: a published code cannot be re-pointed after the fact', () => {
    const twin = createTwinBuilder(catalog(sortEntry)).build('SORT_UNINDEXED_SPILL');

    expect(Object.isFrozen(twin)).toBe(true);
    expect(Object.isFrozen(twin.fixes)).toBe(true);
    expect(() => {
      (twin as { code: string }).code = 'SOMETHING_ELSE';
    }).toThrow(TypeError);
  });

  test('a cataloged failure carries at least one populated fix, enforced at build time', () => {
    const violations = validateCatalog(
      catalog({ code: 'NO_FIXES', reason: 'A cataloged failure with no remedy.', fixes: [] }),
    );

    expect(violations.map((violation) => violation.reason)).toContain('empty-fixes');
    expect(() =>
      createTwinBuilder(
        catalog({ code: 'NO_FIXES', reason: 'A cataloged failure with no remedy.', fixes: [] }),
      ),
    ).toThrow(TwinCatalogError);
  });
});

describe('a novel failure is wrapped UNSTRUCTURED, raw preserved (CC3 [08])', () => {
  test('the raw text lands verbatim in received, with no fix invented', () => {
    const twin = unstructuredTwin(RAW);

    expect(twin.code).toBe('UNSTRUCTURED');
    expect(twin.received).toBe(RAW);
    expect(twin.fixes).toEqual([]);
  });

  test('the raw text is never the primary message', () => {
    const twin = unstructuredTwin(RAW);

    expect(twin.reason).not.toBe(RAW);
    expect(twin.reason).not.toContain(RAW);
    expect(twin.reason.length).toBeGreaterThan(0);
  });

  test('a raw Error keeps its message in received, and the twin still self-identifies', () => {
    const twin = unstructuredTwin(new Error(RAW));

    expect(twin.received).toBe(RAW);
    expect(twin.comprehendo).toBe(SPEC_VERSION);
  });

  test('an un-cataloged code routes to UNSTRUCTURED instead of throwing', () => {
    const builder = createTwinBuilder(catalog(sortEntry));

    expect(builder.twinFor(undefined, RAW).code).toBe('UNSTRUCTURED');
    expect(builder.twinFor('NEVER_CATALOGED', RAW).received).toBe(RAW);
  });

  test('a cataloged failure still keeps the raw text, it is just not the answer', () => {
    const twin = createTwinBuilder(catalog(sortEntry)).twinFor('SORT_UNINDEXED_SPILL', RAW);

    expect(twin.code).toBe('SORT_UNINDEXED_SPILL');
    expect(twin.received).toBe(RAW);
    expect(twin.reason).not.toContain(RAW);
  });
});

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

describe('the entry surface: err.twin on a thrown error', () => {
  const builder = () => createTwinBuilder(catalog(sortEntry));

  test('errorFor returns an error whose twin is the cataloged twin', () => {
    const error = builder().errorFor('SORT_UNINDEXED_SPILL', RAW);

    expect(error).toBeInstanceOf(Error);
    expect(error.twin.code).toBe('SORT_UNINDEXED_SPILL');
    expect(error.twin.fixes[0]?.title).toBe(
      'Sort on the indexed field the pipeline already filters on',
    );
  });

  test('the error message is the reason, never the raw text (CC3 [08])', () => {
    const error = builder().errorFor(undefined, RAW);

    expect(error.message).toBe(error.twin.reason);
    expect(error.message).not.toContain(RAW);
    expect(error.twin.received).toBe(RAW);
  });

  test('the marker rides on the thrown error, so a caught value can be probed', () => {
    const error = builder().errorFor('SORT_UNINDEXED_SPILL');

    expect(COMPREHENDO_MARKER).toBe(Symbol.for('comprehendo'));
    expect((error as unknown as Record<symbol, unknown>)[Symbol.for('comprehendo')]).toBeTruthy();
  });

  test('the twin self-identifies, which is the mid-failure discovery channel', () => {
    const error = builder().errorFor('SORT_UNINDEXED_SPILL');

    expect(error.twin.comprehendo).toBe(SPEC_VERSION);
  });

  test('attachTwin decorates an error the provider already has', () => {
    const existing = new TypeError('driver blew up');
    const twin = unstructuredTwin(RAW);
    const decorated = attachTwin(existing, twin);

    expect(decorated).toBe(existing);
    expect(decorated.twin).toBe(twin);
    expect((decorated as unknown as Record<symbol, unknown>)[COMPREHENDO_MARKER]).toBeTruthy();
  });

  test('err.twin cannot be swapped out once attached', () => {
    const error = builder().errorFor('SORT_UNINDEXED_SPILL');

    expect(() => {
      (error as { twin: unknown }).twin = { code: 'FAKE' };
    }).toThrow(TypeError);
  });
});
