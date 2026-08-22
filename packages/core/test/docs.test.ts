// Docs Engine [13]: the packed-corpus artifact, the index, the three
// vocabularies, and UNDOCUMENTED.
//
// The fixture corpus in test/fixtures/ is a real packed artifact in the format
// this feature defines (see the header of src/docs.ts). Its topic bodies for
// `aggregation stages`, `$group` and `how to undo a write` are the 04 kit's
// own golden text, so the engine is exercised against the spec's examples.

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  COMPREHENDO_VERSION,
  createDocs,
  loadPackedCorpus,
  parsePackedCorpus,
  PACKED_CORPUS_FORMAT,
  type DocsIndex,
  type DocsTopic,
  type PackedCorpus,
  type Undocumented,
} from '../src/docs.js';

const CORPUS_PATH = fileURLToPath(
  new URL('./fixtures/mongodb-operator.packed.json', import.meta.url),
);

// CC5 [02]'s budgets, read-only from the language-neutral kit, exactly the way
// packages/spec/test/fixtures-docs.test.mjs consumes them. The specifier is
// computed so TypeScript never tries to resolve a plain-JS kit module; the
// numbers still come from the kit itself, never from a copy.
interface BudgetRecord {
  readonly scope: string;
  readonly limit: number;
  readonly measured: number;
  readonly pass: boolean;
  readonly encoding: string;
}
interface BudgetKit {
  readonly measureScope: (scope: string, payload: unknown) => BudgetRecord;
  readonly BUDGETS: Readonly<Record<string, number>>;
}
const kitUrl = new URL('../../spec/kit/budget/measure.js', import.meta.url).href;
const budgetsUrl = new URL('../../spec/kit/budget/budgets.js', import.meta.url).href;
const { measureScope } = (await import(kitUrl)) as BudgetKit;
const { BUDGETS } = (await import(budgetsUrl)) as BudgetKit;

const corpus = (): PackedCorpus => loadPackedCorpus(CORPUS_PATH);
const engine = (): ReturnType<typeof createDocs> =>
  createDocs(corpus(), { sink: () => undefined });

const asTopic = (r: unknown): DocsTopic => r as DocsTopic;
const asIndex = (r: unknown): DocsIndex => r as DocsIndex;
const asMiss = (r: unknown): Undocumented => r as Undocumented;
const isMiss = (r: unknown): boolean =>
  typeof r === 'object' && r !== null && (r as { code?: string }).code === 'UNDOCUMENTED';

describe('the packed-corpus artifact', () => {
  it('loads the whole corpus from one artifact, index plus topic bodies', () => {
    const packed = corpus();
    expect(packed.packed).toBe(PACKED_CORPUS_FORMAT);
    expect(packed.comprehendo).toBe(COMPREHENDO_VERSION);
    expect(packed.provider).toBe('mongodb-operator');
    expect(packed.index).toEqual([
      'aggregation stages',
      '$group',
      '$graphLookup',
      '$match',
      '$merge',
      'capped collections',
      'sharding',
      'index selection',
      'how to undo a write',
    ]);
    expect(Object.keys(packed.topics)).toHaveLength(packed.index.length);
  });

  it('every topic body carries the three vocabulary tiers it is matched by', () => {
    for (const [name, topic] of Object.entries(corpus().topics)) {
      expect(topic.topic).toBe(name);
      expect(topic.summary.length).toBeGreaterThan(0);
      expect(topic.vocabularies_served.own_terms.length).toBeGreaterThan(0);
      expect(topic.vocabularies_served.translations.length).toBeGreaterThan(0);
      expect(topic.vocabularies_served.task.length).toBeGreaterThan(0);
    }
  });

  it('every see_also pointer names a topic the same artifact carries', () => {
    const packed = corpus();
    for (const topic of Object.values(packed.topics)) {
      for (const pointer of topic.see_also ?? []) {
        expect(packed.index).toContain(pointer);
      }
    }
  });

  it('refuses an artifact that declares no packed format version', () => {
    expect(() => parsePackedCorpus({ comprehendo: '0.1', index: [], topics: {} })).toThrow(
      /packed/i,
    );
  });

  it('refuses a packed format version it does not understand', () => {
    expect(() =>
      parsePackedCorpus({ ...corpus(), packed: PACKED_CORPUS_FORMAT + 1 }),
    ).toThrow(/packed corpus format/i);
  });

  it('refuses an artifact whose index and topic map disagree', () => {
    const packed = corpus();
    expect(() =>
      parsePackedCorpus({ ...packed, index: [...packed.index, 'not a topic'] }),
    ).toThrow(/not a topic/);
  });

  it('refuses an artifact carrying a topic the index never advertises', () => {
    const packed = corpus();
    const topics = { ...packed.topics, orphan: { ...packed.topics['$group'], topic: 'orphan' } };
    expect(() => parsePackedCorpus({ ...packed, topics })).toThrow(/orphan/);
  });

  it('refuses a topic with no vocabularies at all: it could never be reached', () => {
    const packed = corpus();
    const topics = {
      ...packed.topics,
      sharding: {
        ...packed.topics['sharding'],
        vocabularies_served: { own_terms: [], translations: [], task: [] },
      },
    };
    expect(() => parsePackedCorpus({ ...packed, topics })).toThrow(/sharding/);
  });
});

describe('docs() with no argument, the index (RFC 5.2.1)', () => {
  it('returns topic names only, in the artifact order', () => {
    const index = asIndex(engine()());
    expect(index.topics).toEqual(corpus().index);
  });

  it('is a menu, never the meal: no body text reaches the index', () => {
    const serialized = JSON.stringify(engine()());
    for (const topic of Object.values(corpus().topics)) {
      expect(serialized).not.toContain(topic.summary);
    }
    expect(Object.keys(asIndex(engine()()))).toEqual(['topics']);
  });

  it('measures under the CC5 index budget', () => {
    const record = measureScope('index', engine()());
    expect(record.limit).toBe(BUDGETS['index']);
    expect(record.pass, `index is ${record.measured} tokens, budget ${record.limit}`).toBe(true);
  });

  it('an empty query string is not an unqualified call: it is a miss, never a dump', () => {
    const response = engine()('   ');
    expect(isMiss(response)).toBe(true);
    expect(asMiss(response).query).toBe('   ');
  });
});

describe('docs(query), the three vocabularies (RFC 5.2.2)', () => {
  const queries = {
    ownTerms: '$group',
    translation: 'the SQL equivalent of GROUP BY',
    task: 'how to count events per key',
  };

  it('vocabulary one, the tool own terms, resolves to $group', () => {
    expect(asTopic(engine()(queries.ownTerms)).topic).toBe('$group');
  });

  it('vocabulary two, a known tool terms, resolves to $group', () => {
    expect(asTopic(engine()(queries.translation)).topic).toBe('$group');
  });

  it('vocabulary three, task language, resolves to $group', () => {
    expect(asTopic(engine()(queries.task)).topic).toBe('$group');
  });

  it('all three vocabularies return the identical topic payload', () => {
    const docs = engine();
    const [head, ...rest] = Object.values(queries).map((q) => docs(q));
    for (const response of rest) expect(response).toEqual(head);
  });

  it('the answer is one topic, never the corpus', () => {
    const answer = asTopic(engine()(queries.task));
    const serialized = JSON.stringify(answer);
    const others = Object.values(corpus().topics).filter((t) => t.topic !== answer.topic);
    for (const other of others) expect(serialized).not.toContain(other.summary);
    expect(answer.summary).toBe(corpus().topics['$group']?.summary);
  });

  it('the topic response is the topic shape, with no corpus-side authoring fields', () => {
    const answer = asTopic(engine()(queries.ownTerms));
    expect(Object.keys(answer).sort()).toEqual(
      ['examples', 'see_also', 'signatures', 'summary', 'topic'].sort(),
    );
    expect('vocabularies_served' in answer).toBe(false);
  });

  it('the fence stands where docs answers: a topic never permits a source read', () => {
    for (const query of Object.values(queries)) {
      expect('source_permitted' in (engine()(query) as object)).toBe(false);
    }
  });

  it('matching ignores case, surrounding space, and a trailing question mark', () => {
    const docs = engine();
    expect(asTopic(docs('  $GROUP  ')).topic).toBe('$group');
    expect(asTopic(docs('How To Count Events Per Key?')).topic).toBe('$group');
  });

  it('every topic in the corpus is reachable from each of its three tiers', () => {
    const docs = engine();
    for (const topic of Object.values(corpus().topics)) {
      const tiers = [
        topic.vocabularies_served.own_terms[0],
        topic.vocabularies_served.translations[0]?.terms[0],
        topic.vocabularies_served.task[0],
      ];
      for (const term of tiers) {
        expect(term).toBeDefined();
        const response = docs(term as string);
        expect(isMiss(response), `${topic.topic} unreachable from "${term ?? ''}"`).toBe(false);
        expect(asTopic(response).topic).toBe(topic.topic);
      }
    }
  });

  it('every topic answer measures under the CC5 topic budget', () => {
    const docs = engine();
    for (const topic of Object.values(corpus().topics)) {
      const record = measureScope('topic', docs(topic.topic));
      expect(record.limit).toBe(BUDGETS['topic']);
      expect(
        record.pass,
        `${topic.topic} is ${record.measured} tokens, budget ${record.limit}`,
      ).toBe(true);
    }
  });
});

describe('UNDOCUMENTED, the honest miss (RFC 5.2.3)', () => {
  const missed = 'how do I shard a capped collection';

  it('an unmatched query returns UNDOCUMENTED, never an empty result', () => {
    const response = asMiss(engine()(missed));
    expect(response.comprehendo).toBe(COMPREHENDO_VERSION);
    expect(response.code).toBe('UNDOCUMENTED');
    expect(response.query).toBe(missed);
    expect(response.source_permitted).toBe(true);
    expect(Object.keys(response).sort()).toEqual(
      ['code', 'comprehendo', 'nearest', 'query', 'source_permitted'].sort(),
    );
  });

  it('names what it was near, and never the query itself', () => {
    const response = asMiss(engine()(missed));
    expect(response.nearest.length).toBeGreaterThan(0);
    expect(response.nearest).not.toContain(missed);
    expect(new Set(response.nearest).size).toBe(response.nearest.length);
    expect([...response.nearest].sort()).toEqual(['capped collections', 'sharding']);
  });

  it('suggests only topics the index actually carries', () => {
    const packed = corpus();
    for (const candidate of asMiss(engine()(missed)).nearest) {
      expect(packed.index).toContain(candidate);
    }
  });

  it('the source pass is per question: a second miss carries its own grant', () => {
    const docs = engine();
    const first = asMiss(docs(missed));
    const second = asMiss(docs('how do I resize a capped collection in place'));
    expect(first.query).not.toBe(second.query);
    expect(first.source_permitted).toBe(true);
    expect(second.source_permitted).toBe(true);
  });

  it('did-you-mean draws on all three vocabulary tiers', () => {
    const docs = engine();
    // own terms: a near miss on the operator name itself.
    expect(asMiss(docs('$grup')).nearest).toContain('$group');
    // translation: a near miss on a term only the SQL tier carries.
    expect(asMiss(docs('horizontal partitionin')).nearest).toContain('sharding');
    // task language: a near miss on a phrase only the task tier carries.
    expect(asMiss(docs('spread a colection across machines')).nearest).toContain('sharding');
  });

  it('reproduces the kit did-you-mean transcript: $grup is near $group and $graphLookup', () => {
    const response = asMiss(engine()('$grup'));
    expect(response.query).toBe('$grup');
    expect(response.nearest).toEqual(['$group', '$graphLookup']);
  });

  it('never guesses: an ambiguous query is UNDOCUMENTED naming the candidates', () => {
    const response = engine()('group by index selection');
    expect(isMiss(response), 'an ambiguous query was answered with one topic').toBe(true);
    expect(asMiss(response).nearest).toEqual(['$group', 'index selection']);
  });

  it('did-you-mean is bounded: a miss never returns a list the size of the corpus', () => {
    const docs = engine();
    for (const query of [missed, '$grup', 'stage', 'collection index write']) {
      expect(asMiss(docs(query)).nearest.length).toBeLessThanOrEqual(3);
    }
  });

  it('a query with no signal at all gets an honest empty nearest, never filler', () => {
    const response = asMiss(engine()('zzzzqqqq wwwwvvvv'));
    expect(response.code).toBe('UNDOCUMENTED');
    expect(response.nearest).toEqual([]);
  });

  it('an UNDOCUMENTED response measures well under the topic budget', () => {
    const record = measureScope('topic', engine()(missed));
    expect(record.pass).toBe(true);
  });
});
