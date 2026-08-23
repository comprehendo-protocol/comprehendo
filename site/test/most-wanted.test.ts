// Registry Website [40] AC3, the half that is a decision rather than a read:
// how issue reactions become a ranked list, and what the projection refuses.
//
// The live half of AC3 is `github-live.test.ts`, which runs this same parser
// over bytes a real GitHub really sent. What is exercised here is the shape of
// the decision: pull requests are not corpus requests, a closed request is not
// demand, and rank is reaction order, never issue order.
//
// @see .mdd/docs/40-registry-website.md

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { issueRecordsOf } from '../src/github.ts';
import { rankRequests } from '../src/most-wanted.ts';
import type { IssueRecord } from '../src/most-wanted.ts';

const issue = (over: Partial<IssueRecord>): IssueRecord => ({
  number: 1,
  title: 'a corpus for something',
  url: 'https://github.com/comprehendo-protocol/registry/issues/1',
  state: 'open',
  upvotes: 0,
  totalReactions: 0,
  isPullRequest: false,
  labels: ['corpus-request'],
  ...over,
});

describe('the most-wanted list ranks by reactions', () => {
  it('orders by thumbs-up count, highest demand first', () => {
    const ranked = rankRequests([
      issue({ number: 1, upvotes: 2, totalReactions: 2 }),
      issue({ number: 2, upvotes: 9, totalReactions: 9 }),
      issue({ number: 3, upvotes: 5, totalReactions: 5 }),
    ]);

    assert.deepEqual(ranked.map((request) => request.number), [2, 3, 1]);
    assert.deepEqual(ranked.map((request) => request.rank), [1, 2, 3]);
  });

  it('breaks a tie on total reactions, then on the older issue', () => {
    const ranked = rankRequests([
      issue({ number: 7, upvotes: 4, totalReactions: 4 }),
      issue({ number: 3, upvotes: 4, totalReactions: 4 }),
      issue({ number: 9, upvotes: 4, totalReactions: 11 }),
    ]);

    assert.deepEqual(ranked.map((request) => request.number), [9, 3, 7]);
  });

  it('keeps a request nobody has reacted to, ranked last rather than dropped', () => {
    const ranked = rankRequests([
      issue({ number: 1, upvotes: 0, totalReactions: 0 }),
      issue({ number: 2, upvotes: 1, totalReactions: 1 }),
    ]);

    assert.deepEqual(ranked.map((request) => request.number), [2, 1]);
    assert.equal(ranked[1]?.upvotes, 0);
  });

  it('never ranks a pull request: a PR is a submission, not a request', () => {
    const ranked = rankRequests([
      issue({ number: 1, upvotes: 50, totalReactions: 50, isPullRequest: true }),
      issue({ number: 2, upvotes: 1, totalReactions: 1 }),
    ]);

    assert.deepEqual(ranked.map((request) => request.number), [2]);
  });

  it('never ranks a closed issue: a settled request is not open demand', () => {
    const ranked = rankRequests([
      issue({ number: 1, upvotes: 50, totalReactions: 50, state: 'closed' }),
      issue({ number: 2, upvotes: 1, totalReactions: 1 }),
    ]);

    assert.deepEqual(ranked.map((request) => request.number), [2]);
  });

  it('carries the issue url through, so a reader can go and react', () => {
    const ranked = rankRequests([issue({ number: 42, url: 'https://example.invalid/i/42' })]);

    assert.equal(ranked[0]?.url, 'https://example.invalid/i/42');
    assert.equal(ranked[0]?.title, 'a corpus for something');
  });
});

describe('the issues payload is projected, never trusted', () => {
  it('reads the fields the list actually needs off a well-formed entry', () => {
    const records = issueRecordsOf([
      {
        number: 5,
        title: 'corpus for imagemagick',
        html_url: 'https://github.com/comprehendo-protocol/registry/issues/5',
        state: 'open',
        labels: [{ name: 'corpus-request' }],
        reactions: { '+1': 12, total_count: 15 },
      },
    ]);

    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {
      number: 5,
      title: 'corpus for imagemagick',
      url: 'https://github.com/comprehendo-protocol/registry/issues/5',
      state: 'open',
      upvotes: 12,
      totalReactions: 15,
      isPullRequest: false,
      labels: ['corpus-request'],
    });
  });

  it('marks an entry carrying a pull_request key as a pull request', () => {
    const records = issueRecordsOf([
      {
        number: 6,
        title: 'add the imagemagick corpus',
        html_url: 'https://github.com/comprehendo-protocol/registry/pull/6',
        state: 'open',
        pull_request: { url: 'https://api.github.com/repos/x/y/pulls/6' },
        reactions: { '+1': 3, total_count: 3 },
      },
    ]);

    assert.equal(records[0]?.isPullRequest, true);
  });

  it('drops an entry it cannot read rather than guessing a number or a title', () => {
    const records = issueRecordsOf([
      { title: 'no number here', html_url: 'https://example.invalid/1' },
      { number: 2, html_url: 'https://example.invalid/2' },
      { number: 3, title: 'kept', html_url: 'https://example.invalid/3' },
    ]);

    assert.deepEqual(records.map((record) => record.number), [3]);
  });

  it('reads a missing reactions block as zero demand, not as an error', () => {
    const records = issueRecordsOf([
      { number: 8, title: 'no reactions', html_url: 'https://example.invalid/8', state: 'open' },
    ]);

    assert.equal(records[0]?.upvotes, 0);
    assert.equal(records[0]?.totalReactions, 0);
  });

  it('reads a payload that is not an array as no issues at all', () => {
    assert.deepEqual(issueRecordsOf({ message: 'Not Found' }), []);
  });
});
