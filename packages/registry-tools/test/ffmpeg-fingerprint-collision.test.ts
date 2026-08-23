// ffmpeg Fingerprints [33] against Submission Gate [29]'s fingerprint lint:
// twelve stderr patterns entering a registry that already carries other
// corpora.
//
// The lint's subject is not "does this corpus compile", it is "does the ONE
// index the whole registry compiles to still build once this corpus is in it",
// which is why `fingerprintFindings` takes the PR's corpora AND the corpora
// already on main. This suite puts the real `corpora/ffmpeg/` on both sides of
// that question against real corpora authored by Corpus Generator [17] itself,
// never a typed entry standing in for one.
//
// Two failure shapes live here and they are NOT the same shape:
//
//   1. A COLLISION: two corpora declaring the identical fingerprint. The index
//      refuses to build and the gate names both packages. Proved to have teeth
//      by making one, out of ffmpeg's own real pattern.
//   2. An OVERLAP: two corpora declaring DIFFERENT patterns that one real
//      stderr satisfies at once. Nothing at build time can call that a defect
//      (neither pattern is wrong), so the honest answer is owed at runtime, and
//      it is UNSTRUCTURED with both entries named, never one package's fix. It
//      is a real hazard for this corpus specifically: `*: No such file or
//      directory*` is generic enough that another CLI corpus could plausibly
//      claim something that overlaps it.

import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { CorpusSource } from '../src/corpus-format.js';
import { buildFingerprintIndex } from '../src/fingerprint.js';
import { runSubmissionGate } from '../src/gate.js';
import { buildIndex, fingerprintFindings, fingerprintsOf } from '../src/gate-fingerprint.js';
import type { SubmissionCorpus } from '../src/gate-result.js';
import { requireFfmpeg } from './helpers/ffmpeg-cli.js';
import { FFMPEG_DIRECTORY, loadFfmpegCorpus } from './helpers/ffmpeg-corpus.js';
import { catalogedStderr, type CatalogedStderr } from './helpers/ffmpeg-stderr.js';
import { cleanAll, fixture, type Fixture } from './helpers/gate-fixture.js';

let corpus: CorpusSource;
let captured: readonly CatalogedStderr[];

beforeAll(() => {
  requireFfmpeg();
  corpus = loadFfmpegCorpus();
  captured = catalogedStderr();
}, 300_000);

afterEach(cleanAll);

const ffmpeg = (): SubmissionCorpus => ({ directory: FFMPEG_DIRECTORY, source: corpus });

/** The real cataloged pattern this suite builds its deliberate defects out of. */
const patternOf = (code: string): string => {
  const pattern = corpus.twins.find((twin) => twin.code === code)?.fingerprint.messagePattern;
  if (pattern === undefined) throw new Error(`the corpus no longer catalogs ${code}`);
  return pattern;
};

/**
 * Re-author a toy corpus so ONE of its twins claims `pattern` and no error
 * class, the way another CLI-targeting corpus would: through Corpus Generator
 * [17]'s own writer, so what the gate reads is a corpus 17 really produced.
 *
 * One twin, not all of them: giving every twin the same pattern would be an
 * intra-package collision, and this suite's subject is the cross-package one.
 */
const claim = async (made: Fixture, pattern: string): Promise<void> => {
  await made.rewrite((authored) => ({
    ...authored,
    twins: authored.twins.map((twin, at) =>
      at === 0
        ? { ...twin, fingerprint: { exception: '', message_pattern: pattern, kind: 'runtime-error' } }
        : twin,
    ),
  }));
};

describe('the ffmpeg set collides with nothing already in the registry', () => {
  it('reports no finding with two unrelated corpora in the same PR', async () => {
    const encoder = await fixture('toy-encoder');
    const tagger = await fixture('toy-tagger');

    expect(fingerprintFindings([ffmpeg(), encoder.submission(), tagger.submission()])).toEqual([]);
  });

  it('reports no finding when ffmpeg is the PR and the others are already on main', async () => {
    const encoder = await fixture('toy-encoder');
    const tagger = await fixture('toy-tagger');

    expect(
      fingerprintFindings([ffmpeg()], [encoder.submission(), tagger.submission()]),
    ).toEqual([]);
  });

  it('builds ONE index carrying every package, ffmpeg included', async () => {
    const encoder = await fixture('toy-encoder');
    const index = buildIndex([ffmpeg(), encoder.submission()]);
    const packages = [...new Set(index.entries.map((entry) => entry.package))].sort();

    expect(packages).toEqual(['ffmpeg', 'toy-encoder']);
    expect(index.entries.filter((entry) => entry.package === 'ffmpeg').length).toBe(
      corpus.twins.length,
    );
    expect(index.entries.length).toBe(fingerprintsOf(corpus).length + fingerprintsOf(encoder.source()).length);
  });

  it('still routes every real ffmpeg failure to its own entry inside that index', async () => {
    const encoder = await fixture('toy-encoder');
    const index = buildIndex([ffmpeg(), encoder.submission()]);

    // Distinct SIGNATURES are what the lint checks; distinct TEXT is what an
    // agent experiences. Twelve real stderr blobs, matched against the
    // combined registry index rather than against ffmpeg's own.
    for (const seen of captured) {
      const result = index.match(seen.stderr);

      expect(result.outcome, seen.code).toBe('matched');
      if (result.outcome !== 'matched') continue;
      expect(result.entry.package).toBe('ffmpeg');
      expect(result.entry.corpusEntryId).toBe(seen.code);
    }

    expect(captured.length).toBe(corpus.twins.length);
  });

  it('passes the fingerprint lint through the real submission gate', async () => {
    const encoder = await fixture('toy-encoder');

    const result = runSubmissionGate({
      prId: 'ffmpeg-fingerprints-33',
      corpora: [ffmpeg()],
      published: [encoder.submission()],
    });

    expect(result.checks.fingerprintLint).toBe('pass');
    expect(result.findings.filter((found) => found.check === 'fingerprintLint')).toEqual([]);
    expect(result.index?.entries.length).toBe(corpus.twins.length + encoder.source().twins.length);
  });
});

describe('the lint has teeth against this corpus specifically', () => {
  it('names both packages when another corpus claims an ffmpeg pattern verbatim', async () => {
    const tagger = await fixture('toy-tagger');
    await claim(tagger, patternOf('FFMPEG_INPUT_NOT_FOUND'));

    const found = fingerprintFindings([tagger.submission()], [ffmpeg()]);
    const said = found.map((entry) => `${entry.locator} ${entry.message}`).join('\n');

    expect(found.length).toBeGreaterThan(0);
    expect(found.every((entry) => entry.check === 'fingerprintLint')).toBe(true);
    expect(said).toContain('ffmpeg');
    expect(said).toContain('toy-tagger');
    expect(said).toContain('No such file or directory');
  });

  it('fails the gate and compiles no index at all when that collision is in a PR', async () => {
    const tagger = await fixture('toy-tagger');
    await claim(tagger, patternOf('FFMPEG_UNKNOWN_ENCODER'));

    const result = runSubmissionGate({
      prId: 'ffmpeg-fingerprints-33-collision',
      corpora: [tagger.submission()],
      published: [ffmpeg()],
    });

    expect(result.checks.fingerprintLint).toBe('fail');
    expect(result.pass).toBe(false);
    expect(result.publishable).toBe(false);
    expect(result.index).toBeUndefined();
    expect(result.violations.join('\n')).toContain('FFMPEG_UNKNOWN_ENCODER');
  });
});

describe('an OVERLAPPING claim from another package is not a collision', () => {
  it('builds clean, then answers UNSTRUCTURED naming both, never one package fix', async () => {
    // A different pattern, not the same one: no build-time check can call
    // either of them wrong, so nothing here is a lint finding.
    const tagger = await fixture('toy-tagger');
    await claim(tagger, '*No such file or directory*');

    expect(fingerprintFindings([tagger.submission()], [ffmpeg()])).toEqual([]);

    const index = buildIndex([tagger.submission()], [ffmpeg()]);
    const seen = captured.find((entry) => entry.code === 'FFMPEG_INPUT_NOT_FOUND');
    if (seen === undefined) return expect.unreachable('the input-not-found induction did not run');
    const result = index.match(seen.stderr);

    expect(result.outcome).toBe('ambiguous');
    if (result.outcome === 'matched') return;
    expect(result.twin.code).toBe('UNSTRUCTURED');
    expect(result.twin.fixes).toEqual([]);
    expect(result.twin.received).toBe(seen.stderr);
    expect(result.twin.accepts).toContain('ffmpeg#FFMPEG_INPUT_NOT_FOUND');
    expect(result.twin.accepts?.some((name) => name.startsWith('toy-tagger#'))).toBe(true);
  });

  it('leaves the other eleven cataloged failures answering exactly as before', async () => {
    const tagger = await fixture('toy-tagger');
    await claim(tagger, '*No such file or directory*');
    const index = buildIndex([tagger.submission()], [ffmpeg()]);

    for (const seen of captured) {
      if (seen.code === 'FFMPEG_INPUT_NOT_FOUND') continue;
      const result = index.match(seen.stderr);

      expect(result.outcome, seen.code).toBe('matched');
      if (result.outcome !== 'matched') continue;
      expect(result.entry.corpusEntryId).toBe(seen.code);
    }
  });
});

describe('the compiled ffmpeg fingerprints are the ones the corpus declares', () => {
  it('carries one message-pattern entry per cataloged twin, and no other facet', () => {
    const compiled = fingerprintsOf(corpus);

    expect(compiled.map((entry) => entry.corpusEntryId).sort()).toEqual(
      corpus.twins.map((twin) => twin.code).sort(),
    );
    for (const entry of compiled) {
      expect(entry.package).toBe('ffmpeg');
      expect(entry.messagePattern).toBeTruthy();
      expect(entry.errorClass).toBeUndefined();
      expect(entry.stackShape).toBeUndefined();
      expect(entry.kind).toBe('runtime-error');
    }
  });

  it('is a set of twelve distinct fingerprints, so no entry shadows another', () => {
    // Same-package duplicates are collisions too: the builder refuses them
    // without any second corpus in the picture.
    expect(() => buildFingerprintIndex(fingerprintsOf(corpus))).not.toThrow();
    expect(new Set(fingerprintsOf(corpus).map((entry) => entry.messagePattern)).size).toBe(
      corpus.twins.length,
    );
  });
});
