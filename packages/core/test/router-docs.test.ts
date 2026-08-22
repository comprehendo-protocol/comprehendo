// Router & Precedence [22], the `docs(pkg, query)` surface.
//
// The sidecar equivalent of a native docs() call: name an un-adopted package,
// ask a question, get one topic-sized answer from its installed corpus. The
// answering itself is Docs Engine [13]'s, unchanged and not reimplemented
// here; the router only picks the corpus and hands the query over.

import { describe, expect, it } from 'vitest';

describe('docs(pkg, query) answers from the installed sidecar corpus', () => {
  it('returns one topic for an answerable query', () => {
    expect.fail('MDD skeleton');
  });

  it('answers in a vocabulary the corpus serves, not only its own terms', () => {
    expect.fail('MDD skeleton');
  });

  it('returns the index, the menu never the meal, when no query is given', () => {
    expect.fail('MDD skeleton');
  });

  it('records the lookup through the corpus own docs engine', () => {
    expect.fail('MDD skeleton');
  });
});

describe('an unanswerable docs query is honest (CC10)', () => {
  it('returns UNDOCUMENTED with did-you-mean candidates', () => {
    expect.fail('MDD skeleton');
  });

  it('returns UNDOCUMENTED for a package with no installed corpus, never throws', () => {
    expect.fail('MDD skeleton');
  });

  it('permits source for the one question it could not answer', () => {
    expect.fail('MDD skeleton');
  });
});

describe('docs and precedence', () => {
  it('answers from the sidecar corpus for a natively adopted package', () => {
    expect.fail('MDD skeleton');
  });

  it('still reports source native for that package through decideFor', () => {
    expect.fail('MDD skeleton');
  });
});
