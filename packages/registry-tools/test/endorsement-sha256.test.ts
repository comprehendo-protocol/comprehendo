// Owner Endorsement [30]: the sha256 pin, hashed for real.
//
// The pin is the owner's strongest claim, so the hash under it has to be a
// real sha256 over the real published bytes and not a stand-in that agrees
// with itself. Two things are proved here: the primitive answers the published
// digests of two inputs anyone can check by hand, and what it is pointed at is
// Corpus Format [28]'s OWN serialized artifact, not a re-rendering of it.

import { afterEach, describe, expect, it } from 'vitest';

import { pack, parse, serializeCorpus } from '../src/corpus-format.js';
import { corpusDigest, packedDigest, readPin, sha256Hex } from '../src/endorsement-digest.js';
import { cleanAll, fixture } from './helpers/gate-fixture.js';

afterEach(cleanAll);

/** The two digests the world already publishes for these inputs. */
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const COMPREHENDO_SHA256 = 'de73b53adc7abef7a15d8f3f9f117f834c114829bf7b58f00dec5a4e42bc524e';

describe('the pin is a real sha256, checkable against known values', () => {
  it('answers the published digest of the empty string', () => {
    expect(sha256Hex('')).toBe(EMPTY_SHA256);
  });

  it('answers the published digest of "comprehendo"', () => {
    expect(sha256Hex('comprehendo')).toBe(COMPREHENDO_SHA256);
  });
});

describe('what the pin is a hash OF', () => {
  it('hashes the artifact [28] serializes, byte for byte', async () => {
    const made = await fixture();
    const packed = pack(made.source());

    expect(packedDigest(packed)).toBe(sha256Hex(serializeCorpus(packed)));
  });

  it('gives one corpus one digest across two independent parses of its tree', async () => {
    const made = await fixture();

    const first = corpusDigest(parse(made.corpus));
    const second = corpusDigest(parse(made.corpus));

    expect(first.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(second.digest).toBe(first.digest);
  });

  it('changes when one summary in the corpus changes', async () => {
    const made = await fixture();
    const before = corpusDigest(made.source()).digest;

    await made.rewrite((corpus) => ({
      ...corpus,
      topics: corpus.topics.map((topic) => ({
        ...topic,
        summary: `${String(topic['summary'])} One more sentence the owner never pinned.`,
      })),
    }));

    expect(corpusDigest(made.source()).digest).not.toBe(before);
    expect(before).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reports a corpus that does not pack rather than throwing over it', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      twins: corpus.twins.map((twin) => ({ ...twin, reason: 'status: stub' })),
    }));

    const reading = corpusDigest(made.source());

    expect(reading.digest).toBeUndefined();
    expect(reading.problem).toContain('violation');
  });
});

describe('reading the pin the owner declared', () => {
  it('reads a bare 64-character hex digest', () => {
    expect(readPin(COMPREHENDO_SHA256).hex).toBe(COMPREHENDO_SHA256);
  });

  it('reads a "sha256:" prefixed digest, and folds its case', () => {
    expect(readPin(`sha256:${COMPREHENDO_SHA256.toUpperCase()}`).hex).toBe(COMPREHENDO_SHA256);
  });

  it('refuses a corpus package name, which names content rather than fixing it', () => {
    const reading = readPin('@comprehendo/mongodb-operator');

    expect(reading.hex).toBeUndefined();
    expect(reading.problem).toContain('sha256');
  });

  it('refuses a value that is not a string at all', () => {
    const reading = readPin({ sha256: COMPREHENDO_SHA256 });

    expect(reading.hex).toBeUndefined();
    expect(reading.problem).toContain('string');
  });

  it('refuses a digest of the wrong length, which no sha256 ever has', () => {
    expect(readPin(COMPREHENDO_SHA256.slice(0, 40)).hex).toBeUndefined();
  });
});
