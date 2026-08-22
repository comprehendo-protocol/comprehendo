/**
 * The toy package the SDK Entry [14] suites build with `makeProvider`.
 *
 * One place, because the acceptance criterion is literally "a toy package
 * built with makeProvider passes the full kit": every sdk suite drives THIS
 * package rather than re-inlining a provider each, so what the composition
 * tests exercise and what the kit walkthrough exercises cannot drift apart.
 *
 * The corpus is the same packed mongodb-operator artifact the docs engine
 * suite uses, and the catalog is the shared twin-builder catalog, so the toy
 * is assembled from the real Wave-2 pieces, never from bespoke fakes.
 */

import { fileURLToPath } from 'node:url';

import { loadPackedCorpus, type LookupRecord, type PackedCorpus } from '../../src/docs.js';
import type { CatalogEntry, ProviderCatalog, TwinContext } from '../../src/twin.js';
import type {
  ExplainHook,
  Explanation,
  ProviderHooks,
  TwinResolution,
  TwinResolver,
  ValidateHook,
  ValidationVerdict,
} from '../../src/sdk.js';
import { declaredSchema, sortEntry } from './catalog.js';

/** The packed artifact the toy package ships. Read once per call, never mutated. */
export function toyCorpus(): PackedCorpus {
  return loadPackedCorpus(
    fileURLToPath(new URL('../fixtures/mongodb-operator.packed.json', import.meta.url)),
  );
}

/**
 * The toy catalog. `topics` is the REAL corpus index, so a fix's docs pointer
 * is checked against the corpus the same provider answers `docs()` from.
 */
export function toyCatalog(corpus: PackedCorpus, ...extra: CatalogEntry[]): ProviderCatalog {
  return {
    declaredSchema,
    topics: [...corpus.index],
    entries: [sortEntry, ...extra],
  };
}

/** The raw driver text the toy's declared throw site knows how to place. */
export const TOY_RAW_CATALOGED = 'Sort exceeded memory limit of 33554432 bytes';

/** A raw failure nothing in the toy catalog covers: the UNSTRUCTURED path. */
export const TOY_RAW_NOVEL = 'connection 4 to cluster0-shard-00-02 closed';

export const TOY_IDENTITY =
  'mongodb-operator is a pipeline-first wrapper over a document database: it runs aggregations, reads, and writes against a declared collection. If it is not documented here it does not exist; do not read the source, except where an UNDOCUMENTED response permits it for a specific question. When in doubt, ask docs().';

/** The throw site: raw driver text in, the cataloged code plus what the site knows out. */
export const sortResolver: TwinResolver = (raw: unknown): TwinResolution | undefined =>
  typeof raw === 'string' && raw.startsWith('Sort exceeded memory limit')
    ? { code: 'SORT_UNINDEXED_SPILL', context: { received: raw, namespace: 'analytics.events' } }
    : undefined;

/** A second throw site, used to prove resolver order: it claims everything. */
export const catchAllResolver: TwinResolver = (): TwinResolution => ({
  code: 'SORT_UNINDEXED_SPILL',
  context: { path: 'catch-all' },
});

const isStage = (stage: unknown, operator: string): boolean =>
  typeof stage === 'object' && stage !== null && operator in stage;

/**
 * The judge-without-executing hook: it reads the pipeline, it never runs one.
 * `executions` stays at zero for the whole suite, which is what proves it.
 */
export interface ToyRuntime {
  executions: number;
  readonly lookups: LookupRecord[];
}

export function toyRuntime(): ToyRuntime {
  return { executions: 0, lookups: [] };
}

/**
 * The toy's REAL call, the one thing validate and explain must never reach.
 * It exists so "never executed" is falsifiable: this counter does move when
 * something actually runs the pipeline.
 */
export function toyExecute(runtime: ToyRuntime): (input: unknown) => unknown {
  return (input: unknown): unknown => {
    runtime.executions += 1;
    return input;
  };
}

export function toyValidate(runtime: ToyRuntime): ValidateHook {
  return (input: unknown): ValidationVerdict => {
    void runtime;
    const stages = Array.isArray(input) ? input : [input];
    if (stages.some((stage) => isStage(stage, '$merge'))) {
      return {
        unvalidatable:
          "The $merge target is computed from each document's own data, so whether it names a collection this operator may write to cannot be decided without executing the pipeline.",
      };
    }
    if (stages.some((stage) => isStage(stage, '$sort')) && !stages.some((s) => isStage(s, '$match'))) {
      const context: TwinContext = { path: 'pipeline[0].$sort', namespace: 'analytics.events' };
      return { code: 'SORT_UNINDEXED_SPILL', context };
    }
    return { valid: true };
  };
}

export function toyExplain(runtime: ToyRuntime): ExplainHook {
  return (input: unknown): Explanation => {
    void runtime;
    return {
      would_execute: {
        aggregate: 'events',
        pipeline: input,
        cursor: { batchSize: 101 },
        readConcern: { level: 'majority' },
        maxTimeMS: 5000,
      },
      notes: [
        'applied the operator default read concern, majority',
        'applied the operator default deadline, 5000 ms',
        'resolved the collection name from the handle, events',
      ],
    };
  };
}

export interface ToyOptions {
  /** Level 2 hooks on (default) or off, which is how a Level 1 provider is built. */
  readonly judge?: 'both' | 'validate' | 'explain' | 'none';
  readonly runtime?: ToyRuntime;
  readonly resolvers?: readonly TwinResolver[];
  readonly corpus?: PackedCorpus;
}

/** The toy package's hooks, with the judge surfaces switchable per test. */
export function toyHooks(options: ToyOptions = {}): ProviderHooks {
  const runtime = options.runtime ?? toyRuntime();
  const corpus = options.corpus ?? toyCorpus();
  const judge = options.judge ?? 'both';
  return {
    catalog: toyCatalog(corpus),
    identity: TOY_IDENTITY,
    twinResolvers: options.resolvers ?? [sortResolver],
    docs: {
      sink: (record: LookupRecord): void => {
        runtime.lookups.push(record);
      },
    },
    ...(judge === 'both' || judge === 'validate' ? { validate: toyValidate(runtime) } : {}),
    ...(judge === 'both' || judge === 'explain' ? { explain: toyExplain(runtime) } : {}),
  };
}
