// Registry Website [40] AC1: the site renders the current registry contents.
//
// Every row below is read out of `corpora/ffmpeg/`, the one real corpus this
// repository carries, through Corpus Format [28]'s REAL `parse` and `pack`.
// Nothing here is a fixture and no trust tier is invented: a corpus with no
// submission-gate ruling beside it is listed at `community`, unpublished, with
// the reason spelled out, because that is what is true of it.
//
// @see .mdd/docs/40-registry-website.md

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { listingOf, registryListing } from '../src/registry.ts';
import type { RegistryEntryInput } from '../src/registry.ts';
import { loadFfmpeg } from './support.ts';

const ffmpegEntry = async (): Promise<RegistryEntryInput> => {
  const { corpus, packed } = await loadFfmpeg();
  return { directory: 'ffmpeg', corpus, packed };
};

describe('the registry listing reads the real corpus', () => {
  it('names the package, provider and target version the corpus really declares', async () => {
    const { corpus } = await loadFfmpeg();
    const listing = listingOf(await ffmpegEntry());

    assert.equal(listing.directory, 'ffmpeg');
    assert.equal(listing.package, corpus.package);
    assert.equal(listing.provider, corpus.provider);
    assert.equal(listing.targetVersion, corpus.version);
  });

  it('carries the corpus topic menu in the corpus own menu order', async () => {
    const { corpus } = await loadFfmpeg();
    const listing = listingOf(await ffmpegEntry());

    assert.deepEqual(listing.topics, corpus.topics.map((topic) => topic.topic));
    assert.ok(listing.topics.length > 0);
  });

  it('counts the cataloged failures and fixes the corpus really carries', async () => {
    const { corpus } = await loadFfmpeg();
    const listing = listingOf(await ffmpegEntry());

    assert.equal(listing.twinCount, corpus.twins.length);
    assert.equal(
      listing.fixCount,
      Object.values(corpus.fixes).reduce((total, fixes) => total + fixes.length, 0),
    );
    assert.ok(listing.twinCount > 0);
  });

  it('sorts the registry by directory, so the page order is not disk order', async () => {
    const entry = await ffmpegEntry();
    const second: RegistryEntryInput = { ...entry, directory: 'aardvark' };
    const listed = registryListing([entry, second]);

    assert.deepEqual(
      listed.map((row) => row.directory),
      ['aardvark', 'ffmpeg'],
    );
  });
});

describe('no trust tier is invented', () => {
  it('lists a corpus with no gate ruling as an unpublished community corpus', async () => {
    const listing = listingOf(await ffmpegEntry());

    assert.equal(listing.trust, 'community');
    assert.equal(listing.published, false);
    assert.equal(listing.verifiedAgainstUpstream, false);
    assert.match(listing.reasons.join('\n'), /no submission-gate ruling/i);
  });

  it('records what the live manifest said, which with no ruling is nothing', async () => {
    const listing = listingOf(await ffmpegEntry());

    assert.equal(listing.manifestSnapshot.package, 'ffmpeg');
    assert.equal(listing.manifestSnapshot.declaredName, undefined);
    assert.ok(listing.manifestSnapshot.problems.length > 0);
  });
});

describe('the trust tier rests on the submission gate, not on the site', () => {
  it('refuses every rung above community when a REAL gate run never verified upstream', async () => {
    const { corpus, packed } = await loadFfmpeg();
    const { runSubmissionGate } = await import('../../packages/registry-tools/dist/gate.js');
    const gate = runSubmissionGate({
      prId: 'site-40-unverified',
      corpora: [{ directory: 'ffmpeg', source: corpus }],
    });

    assert.equal(gate.checks.registryTruth, 'not-run');

    const listing = listingOf({
      directory: 'ffmpeg',
      corpus,
      packed,
      ruling: {
        gate,
        manifest: { name: 'ffmpeg', version: '4.4.2', comprehendo: { version: '0.1', level: 1 } },
      },
    });

    assert.equal(listing.trust, 'community');
    assert.equal(listing.published, false);
    assert.equal(listing.verifiedAgainstUpstream, false);
    assert.match(listing.reasons.join('\n'), /registryTruth/);
  });
});
