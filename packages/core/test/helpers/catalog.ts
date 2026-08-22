// Shared test catalog for the Twin Builder [12] suites.
//
// One provider, declared read-only, matching the call surface the conformance
// kit's fixtures declare. Both the construction suite and the gate suite build
// their catalogs from here rather than re-inlining a provider each.

import type { CatalogEntry, ProviderCatalog } from '../../src/twin.js';

/** The provider's declared call surface, same shape the negative kit declares. */
export const declaredSchema = {
  surface: 'aggregate(pipeline)',
  operations: ['$match', '$sort', '$limit', '$project', '$group', '$count'],
} as const;

/** The provider's corpus index: the topics a `docs` pointer can resolve to. */
export const topics = ['index selection', 'capped collections'] as const;

/** One cataloged failure, two fixes, in the author's most-likely-first order. */
export const sortEntry: CatalogEntry = {
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

/** A provider catalog over the shared schema and index. */
export const catalog = (...entries: CatalogEntry[]): ProviderCatalog => ({
  declaredSchema,
  topics: [...topics],
  entries,
});

/** The raw driver text the kit uses for the un-cataloged failure. */
export const RAW = 'Sort exceeded memory limit of 33554432 bytes';
