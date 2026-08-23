// Registry Website [40] AC3, live: the most-wanted list really read off GitHub.
//
// NOTHING HERE IS RECORDED OR REPLAYED. Every case below opens a real HTTPS
// connection to api.github.com and judges what really came back, the same
// discipline ffmpeg Corpus [32] applies to the real binary: a suite that
// asserts against a captured payload proves the parser agrees with a file
// somebody wrote once, never that the site can read GitHub.
//
// A missing network fails these tests loudly rather than skipping them, for
// the reason `requireFfmpeg` fails loudly: a green run that called nothing is
// exactly the folklore the project's own rule exists to catch.
//
// THE TARGET REPOSITORY DOES NOT EXIST YET. `comprehendo-protocol/registry` is
// the submission channel Submission Gate [29] describes and it has not been
// created, so the first case below asserts the honest UNAVAILABLE state rather
// than an empty list. The day that repository is created this test goes red,
// which is the correct signal: the site's known issue is stale from that day.
//
// @see .mdd/docs/40-registry-website.md

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchCorpusRequests } from '../src/github.ts';
import { rankRequests } from '../src/most-wanted.ts';

/** Optional, and deliberately not required: the site reads only public data. */
const token = process.env['GITHUB_TOKEN'];

const query = (repository: string, label?: string) => ({
  repository,
  ...(label === undefined ? {} : { label }),
  ...(token === undefined || token === '' ? {} : { token }),
  userAgent: 'comprehendo-site-tests',
});

describe('the registry repository is read for real', () => {
  it('reports a repository that does not exist as unavailable, never as no demand', async () => {
    const list = await fetchCorpusRequests(query('comprehendo-protocol/registry', 'corpus-request'));

    assert.equal(list.kind, 'unavailable');
    assert.equal(list.repository, 'comprehendo-protocol/registry');
    if (list.kind !== 'unavailable') return;
    assert.match(list.reason, /404|not found/i);
  });

  it('reads a repository that does exist and reports an honestly empty list', async () => {
    const list = await fetchCorpusRequests(
      query('comprehendo-protocol/comprehendo', 'corpus-request'),
    );

    assert.equal(list.kind, 'ok');
    if (list.kind !== 'ok') return;
    assert.deepEqual(list.requests, []);
  });
});

/**
 * ONE real call, shared by the three cases below. GitHub allows an
 * unauthenticated build 60 requests an hour, and three assertions about one
 * live payload are three assertions, not three reads.
 */
const populated = fetchCorpusRequests(query('nodejs/node'));

describe('a repository with real issues really ranks', () => {
  it('projects and ranks live issues, with pull requests excluded', async () => {
    const list = await populated;

    assert.equal(list.kind, 'ok');
    if (list.kind !== 'ok') return;
    assert.ok(list.requests.length > 0, 'a live issue tracker returned no issues at all');

    const scores = list.requests.map((request) => request.upvotes);
    assert.deepEqual([...scores].sort((a, b) => b - a), scores);
    assert.deepEqual(
      list.requests.map((request) => request.rank),
      list.requests.map((_request, at) => at + 1),
    );
    for (const request of list.requests) {
      assert.equal(typeof request.number, 'number');
      assert.ok(request.title.length > 0);
      assert.match(request.url, /^https:\/\/github\.com\/nodejs\/node\/issues\/\d+$/);
    }
  });

  it('really carries reaction counts, so the ranking is not ranking zeroes', async () => {
    const list = await populated;

    assert.equal(list.kind, 'ok');
    if (list.kind !== 'ok') return;
    const reacted = list.requests.filter((request) => request.totalReactions > 0);
    assert.ok(reacted.length > 0, 'no live issue carried a single reaction');
  });

  it('ranks the same live payload the same way the pure ranker does', async () => {
    const list = await populated;

    assert.equal(list.kind, 'ok');
    if (list.kind !== 'ok') return;
    const again = rankRequests(
      list.requests.map((request) => ({
        number: request.number,
        title: request.title,
        url: request.url,
        state: 'open',
        upvotes: request.upvotes,
        totalReactions: request.totalReactions,
        isPullRequest: false,
        labels: [],
      })),
    );
    assert.deepEqual(again, list.requests);
  });
});

describe('the read is bounded and named', () => {
  it('refuses a repository that is not spelled owner/name, without calling out', async () => {
    let called = false;
    const list = await fetchCorpusRequests({
      repository: '../../etc/passwd',
      fetchImpl: async () => {
        called = true;
        return new Response('[]', { status: 200 });
      },
    });

    assert.equal(called, false);
    assert.equal(list.kind, 'unavailable');
    if (list.kind !== 'unavailable') return;
    assert.match(list.reason, /owner\/name/);
  });
});
