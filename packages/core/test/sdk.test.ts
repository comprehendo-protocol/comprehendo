/**
 * 14-sdk-entry: makeProvider(corpus, hooks), the composition tests.
 *
 * Every case here drives the toy package from helpers/toy-provider.ts through
 * the surfaces a consumer actually touches. The kit walkthrough (the "a toy
 * package built with the SDK passes the full kit" acceptance criterion) lives
 * next door in sdk-toy-package.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { hasMarker, probe } from '../src/marker.js';
import { SPEC_VERSION, TwinCatalogError, type Twin } from '../src/twin.js';
import { makeProvider, type Provider, type Unvalidatable } from '../src/sdk.js';
import {
  TOY_IDENTITY,
  TOY_RAW_CATALOGED,
  TOY_RAW_NOVEL,
  catchAllResolver,
  sortResolver,
  toyCorpus,
  toyExecute,
  toyHooks,
  toyRuntime,
  type ToyOptions,
} from './helpers/toy-provider.js';

const toy = (options: ToyOptions = {}): Provider =>
  makeProvider(options.corpus ?? toyCorpus(), toyHooks(options));

/** A twin is the shape carrying a code and fixes; the clean verdict is not. */
const asTwin = (value: unknown): Twin => value as Twin;

describe('makeProvider, the Level 1 minimum', () => {
  it("marks the provider object it returns, so a probe on the package's export answers", () => {
    const provider = toy({ judge: 'none' });

    expect(hasMarker(provider)).toBe(true);
    expect(probe(provider)).toBe(provider.entry);
  });

  it('names the provider from the packed corpus it was handed', () => {
    expect(toy({ judge: 'none' }).name).toBe('mongodb-operator');
  });

  it('carries the identity and priming an agent reads off the entry', () => {
    const entry = toy({ judge: 'none' }).entry;

    expect(entry.identity).toBe(TOY_IDENTITY);
    expect(entry.priming.length).toBeGreaterThan(0);
    expect(entry.comprehendo).toBe(SPEC_VERSION);
  });

  it('freezes the entry, so what a value claims about itself cannot be edited later', () => {
    const entry = toy({ judge: 'none' }).entry;

    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.surfaces)).toBe(true);
  });

  it('answers docs() with no argument with the corpus index, the menu never the meal', () => {
    const provider = toy({ judge: 'none' });

    expect(provider.docs()).toEqual({ topics: toyCorpus().index });
  });

  it('answers docs(query) with one topic-sized answer from the packed corpus', () => {
    const answer = toy({ judge: 'none' }).docs('$group');

    expect(answer).toMatchObject({ topic: '$group' });
    expect(answer).not.toHaveProperty('vocabularies_served');
  });

  it('refuses a packed corpus this runtime cannot read, rather than half-wiring one', () => {
    const unreadable = { ...toyCorpus(), packed: 2 };

    expect(() => makeProvider(unreadable, toyHooks())).toThrow(/packed corpus format/i);
  });

  it("refuses a catalog that violates the provider's own declared call schema", () => {
    const corpus = toyCorpus();
    const hooks = {
      ...toyHooks({ corpus }),
      catalog: {
        declaredSchema: { surface: 'aggregate(pipeline)', operations: ['$match'] },
        topics: [...corpus.index],
        entries: [
          {
            code: 'ESCAPES',
            reason: 'a fix that leaves the declared surface',
            fixes: [{ title: 'run this instead', apply: { $eval: 'db.dropDatabase()' } }],
          },
        ],
      },
    };

    expect(() => makeProvider(corpus, hooks)).toThrow(TwinCatalogError);
  });

  it('refuses to build a provider with no identity, which no agent could orient from', () => {
    expect(() => makeProvider(toyCorpus(), { ...toyHooks(), identity: '   ' })).toThrow(/identity/i);
  });
});

describe('conformance level, computed from what hooks actually provided', () => {
  it('declares Level 1 and only the docs surface when nothing can judge', () => {
    const provider = toy({ judge: 'none' });

    expect(provider.level).toBe(1);
    expect(provider.entry.level).toBe(1);
    expect(provider.entry.surfaces).toEqual(['docs']);
  });

  it('OMITS validate entirely at Level 1, never a stub that always returns valid', () => {
    const provider = toy({ judge: 'none' });

    expect('validate' in provider).toBe(false);
    expect('explain' in provider).toBe(false);
  });

  it('declares Level 2 and all three surfaces when hooks judge without executing', () => {
    const provider = toy();

    expect(provider.level).toBe(2);
    expect(provider.entry.level).toBe(2);
    expect(provider.entry.surfaces).toEqual(['docs', 'validate', 'explain']);
  });

  it('stays at Level 1 with only validate, and exposes exactly the surface that exists', () => {
    const provider = toy({ judge: 'validate' });

    expect(provider.level).toBe(1);
    expect(provider.entry.surfaces).toEqual(['docs', 'validate']);
    expect('explain' in provider).toBe(false);
  });

  it('stays at Level 1 with only explain, and exposes exactly the surface that exists', () => {
    const provider = toy({ judge: 'explain' });

    expect(provider.level).toBe(1);
    expect(provider.entry.surfaces).toEqual(['docs', 'explain']);
    expect('validate' in provider).toBe(false);
  });

  it('ignores a hand-set level on hooks: the manifest reflects what was provided', () => {
    const handSet = { ...toyHooks({ judge: 'none' }), level: 2, manifest: { version: '9', level: 2 } };

    const provider = makeProvider(toyCorpus(), handSet);

    expect(provider.manifest).toEqual({ version: SPEC_VERSION, level: 1 });
  });

  it('stamps the manifest declaration from the computed level, frozen', () => {
    const provider = toy();

    expect(provider.manifest).toEqual({ version: SPEC_VERSION, level: 2 });
    expect(Object.isFrozen(provider.manifest)).toBe(true);
  });
});

describe('twins at the declared throw sites', () => {
  it('builds the cataloged twin for a raw failure a resolver places', () => {
    const twin = toy().twinFor(TOY_RAW_CATALOGED);

    expect(twin.code).toBe('SORT_UNINDEXED_SPILL');
    expect(twin.fixes[0]?.title).toBe('Sort on the indexed field the pipeline already filters on');
    expect(twin.received).toBe(TOY_RAW_CATALOGED);
  });

  it('passes an un-cataloged failure through as UNSTRUCTURED, raw preserved verbatim', () => {
    const twin = toy().twinFor(TOY_RAW_NOVEL);

    expect(twin.code).toBe('UNSTRUCTURED');
    expect(twin.received).toBe(TOY_RAW_NOVEL);
    expect(twin.fixes).toEqual([]);
  });

  it('takes the first resolver that claims the failure, in declared order', () => {
    const first = toy({ resolvers: [sortResolver, catchAllResolver] }).twinFor(TOY_RAW_NOVEL);
    const second = toy({ resolvers: [catchAllResolver, sortResolver] }).twinFor(TOY_RAW_CATALOGED);

    expect(first.code).toBe('SORT_UNINDEXED_SPILL');
    expect(first.path).toBe('catch-all');
    expect(second.path).toBe('catch-all');
  });

  it("raises an error carrying the twin and the twin's reason as its message (CC3)", () => {
    const provider = toy();

    const error = provider.errorFor(TOY_RAW_CATALOGED);

    expect(error).toBeInstanceOf(Error);
    expect(error.twin.code).toBe('SORT_UNINDEXED_SPILL');
    expect(error.message).toBe(error.twin.reason);
    expect(error.message).not.toContain(TOY_RAW_CATALOGED);
  });

  it("answers a probe on the RAISED ERROR with the provider's own entry, not a bare true", () => {
    const provider = toy();

    const error = provider.errorFor(TOY_RAW_CATALOGED);

    expect(hasMarker(error)).toBe(true);
    expect(probe(error)).toBe(provider.entry);
  });

  it('raise() throws that same twinned, marked error', () => {
    const provider = toy();

    try {
      provider.raise(TOY_RAW_NOVEL, { path: 'pipeline[0]' });
      expect.unreachable('raise must throw');
    } catch (caught: unknown) {
      expect(probe(caught)).toBe(provider.entry);
      expect((caught as { twin: Twin }).twin.code).toBe('UNSTRUCTURED');
      expect((caught as { twin: Twin }).twin.path).toBeUndefined();
    }
  });

  it('marks a controlled handle with the same entry the export carries', () => {
    const provider = toy();
    const cursor = { next: (): null => null };

    const marked = provider.mark(cursor);

    expect(marked).toBe(cursor);
    expect(probe(cursor)).toBe(provider.entry);
  });

  it('exposes the twin builder for throw sites that already know their code', () => {
    const provider = toy();

    expect(provider.twins.has('SORT_UNINDEXED_SPILL')).toBe(true);
    expect(provider.twins.build('SORT_UNINDEXED_SPILL').code).toBe('SORT_UNINDEXED_SPILL');
  });
});

describe('validate(input), Level 2', () => {
  it('returns the clean verdict for an input that would run', () => {
    const provider = toy();

    expect(provider.validate?.([{ $match: { status: 'active' } }])).toEqual({ valid: true });
  });

  it('returns the cataloged twin for an input that would produce a known failure', () => {
    const provider = toy();

    const verdict = asTwin(provider.validate?.([{ $sort: { created_at: -1 } }]));

    expect(verdict.code).toBe('SORT_UNINDEXED_SPILL');
    expect(verdict.fixes[0]?.apply).toBeDefined();
    expect(verdict.path).toBe('pipeline[0].$sort');
  });

  it('abstains with UNVALIDATABLE where it cannot judge without executing', () => {
    const provider = toy();

    const verdict = provider.validate?.([{ $merge: { into: { $concat: ['events_', '$region'] } } }]);

    expect(verdict).toMatchObject({ valid: null, code: 'UNVALIDATABLE' });
    expect((verdict as Unvalidatable).reason.length).toBeGreaterThan(0);
  });

  it('never executes the input it judges', () => {
    const runtime = toyRuntime();
    const provider = makeProvider(toyCorpus(), toyHooks({ runtime }));

    provider.validate?.([{ $sort: { created_at: -1 } }]);
    provider.explain?.([{ $match: { status: 'active' } }]);

    expect(runtime.executions).toBe(0);
    toyExecute(runtime)([]);
    expect(runtime.executions).toBe(1);
  });

  it('raises loudly when a hook names a code the catalog does not carry', () => {
    const provider = makeProvider(toyCorpus(), {
      ...toyHooks(),
      validate: () => ({ code: 'NOT_IN_THE_CATALOG' }),
    });

    expect(() => provider.validate?.('anything')).toThrow(TwinCatalogError);
  });

  it('raises loudly on a verdict shape it cannot read, rather than guessing valid', () => {
    const provider = makeProvider(toyCorpus(), {
      ...toyHooks(),
      validate: () => ({ probably: 'fine' }) as never,
    });

    expect(() => provider.validate?.('anything')).toThrow(/verdict/i);
  });
});

describe('explain(input), Level 2', () => {
  it('returns the literal form the input would execute as, plus notes', () => {
    const provider = toy();
    const pipeline = [{ $match: { status: 'active' } }];

    const explanation = provider.explain?.(pipeline);

    expect(explanation?.would_execute).toMatchObject({ aggregate: 'events', pipeline });
    expect(explanation?.notes?.length).toBeGreaterThan(0);
  });

  it('freezes what it hands back, so an explanation cannot be edited into a lie', () => {
    const explanation = toy().explain?.([{ $match: {} }]);

    expect(Object.isFrozen(explanation)).toBe(true);
  });
});
