// Router & Precedence [22], the `docs(pkg, query)` surface.
//
// The sidecar equivalent of a native docs() call: name an un-adopted package,
// ask a question, get one topic-sized answer from its installed corpus. The
// answering itself is Docs Engine [13]'s, unchanged and not reimplemented
// here; the router only picks the corpus and hands the query over.

import { beforeAll, describe, expect, it } from 'vitest';

import type { DocsIndex, DocsTopic, LookupRecord, Undocumented } from '../src/docs.js';
import { createRouter } from '../src/router.js';
import type { Router } from '../src/router.js';
import { TOY, nativeEntry, toyEnvironment, toyInstalled, toyPacked } from './helpers/sidecar.js';

const lookups: LookupRecord[] = [];
let router: Router;

beforeAll(async () => {
  router = createRouter(await toyEnvironment({ corpora: [toyInstalled(lookups)] }));
});

describe('docs(pkg, query) answers from the installed sidecar corpus', () => {
  it('returns one topic for an answerable query', () => {
    const answer = router.docs(TOY, 'aggregation stages') as DocsTopic;

    expect(answer.topic).toBe('aggregation stages');
    expect(answer.summary.length).toBeGreaterThan(0);
  });

  it('answers in a vocabulary the corpus serves, not only its own terms', () => {
    // "method chaining" is the pandas translation the corpus declares for
    // that topic: the sidecar tier answers in the asker's vocabulary exactly
    // as the native tier does, because it is the same engine.
    expect((router.docs(TOY, 'method chaining') as DocsTopic).topic).toBe('aggregation stages');
  });

  it('returns the index, the menu never the meal, when no query is given', () => {
    const menu = router.docs(TOY) as DocsIndex;

    expect(menu.topics).toEqual(toyPacked().index);
  });

  it('records the lookup through the corpus own docs engine', () => {
    const before = lookups.length;

    router.docs(TOY, '$graphLookup');

    expect(lookups.slice(before)).toEqual([
      expect.objectContaining({ query: '$graphLookup', result: 'hit', topic: '$graphLookup' }),
    ]);
  });
});

describe('an unanswerable docs query is honest (CC10)', () => {
  it('returns UNDOCUMENTED with did-you-mean candidates', () => {
    const answer = router.docs(TOY, 'shardding') as Undocumented;

    expect(answer.code).toBe('UNDOCUMENTED');
    expect(answer.nearest).toContain('sharding');
  });

  it('returns UNDOCUMENTED for a package with no installed corpus, never throws', () => {
    const answer = router.docs('never-installed', 'anything at all') as Undocumented;

    expect(answer.code).toBe('UNDOCUMENTED');
    expect(answer.query).toBe('anything at all');
    expect(answer.nearest).toEqual([]);
    expect(router.docs('never-installed')).toEqual({ topics: [] });
  });

  it('permits source for the one question it could not answer', () => {
    expect((router.docs(TOY, 'quantum entanglement') as Undocumented).source_permitted).toBe(true);
    expect((router.docs('never-installed', 'anything') as Undocumented).source_permitted).toBe(true);
  });
});

describe('docs and precedence', () => {
  it('answers from the sidecar corpus for a natively adopted package', async () => {
    // The narrowing recorded in JUDGMENT call 5: docs(pkg, query) names the
    // sidecar tier explicitly and the router holds no native handle to
    // forward to, so refusing here would mean answering UNDOCUMENTED while
    // the answer sits in an installed corpus. That is the lie CC10 exists to
    // prevent, so it answers.
    const adopted = createRouter(
      await toyEnvironment({ native: { [TOY]: { marker: nativeEntry() } } }),
    );

    expect((adopted.docs(TOY, 'aggregation stages') as DocsTopic).topic).toBe('aggregation stages');
  });

  it('still reports source native for that package through decideFor', async () => {
    const adopted = createRouter(
      await toyEnvironment({ native: { [TOY]: { marker: nativeEntry() } } }),
    );

    expect(adopted.decideFor(TOY).source).toBe('native');
  });
});
