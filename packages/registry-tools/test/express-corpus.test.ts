// express Corpus against CC4 Folklore Gate [26]: every cataloged twin induced
// against the REAL, installed `express5` (aliased, `npm:express@^5.0.0`),
// `runtime-error` twins by a real thrown error (either at route-registration
// time or against the real `express.request` prototype, see
// `helpers/express-witnesses.ts`), the one `static-pattern` twin by a real,
// live-verified HTTP response, routed through Fingerprint Index & Matcher
// [21]'s REAL, kind-separated indices, with the same real `runSubmissionGate`
// a community corpus passes.

import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CorpusSource } from '../src/corpus-format.js';
import { parse } from '../src/corpus-format.js';
import { buildFingerprintIndex, buildStaticPatternIndex } from '../src/fingerprint.js';
import { fingerprintsOf } from '../src/gate-fingerprint.js';
import { runSubmissionGate } from '../src/gate.js';
import { GATE_CHECKS } from '../src/gate-result.js';
import type { TruthFailure, UpstreamVerification } from '../src/gate-upstream.js';
import {
  RUNTIME_WITNESSES,
  STATIC_WITNESSES,
  expressVersion,
  induceRuntime,
} from './helpers/express-witnesses.js';
import { specMeter } from './helpers/spec-meter.js';

const CORPUS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'express');
const FFMPEG_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'ffmpeg');
const OPENAI_PYTHON_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'openai-python');
const MCP_OAUTH_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'mcp-oauth');
const ZOD_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'zod');
const DIRECTORY = 'express';

const corpus: CorpusSource = parse(CORPUS_DIR);

/**
 * `UpstreamVerification`, built by hand, the same reasoning
 * `zod-corpus.test.ts` gives for its own: express is a direct devDependency
 * (aliased) of this package, so most induction here is the plainest form
 * CC4 [26] asks for. The one twin needing a real request/response cycle to
 * observe (the static-pattern claim) still gets one, in test code, which
 * CC6 [27]'s corpus-content scan never reaches (only the corpus's own
 * EXAMPLE text is scanned, see `corpora/express/README.md`).
 */
async function induceAll(): Promise<UpstreamVerification> {
  const entries = fingerprintsOf(corpus);
  const runtimeIndex = buildFingerprintIndex(entries);
  const patternIndex = buildStaticPatternIndex(entries);
  const inducedCodes: string[] = [];
  const failures: TruthFailure[] = [];

  for (const witness of RUNTIME_WITNESSES) {
    const twin = corpus.twins.find((one) => one.code === witness.code);
    if (twin === undefined) {
      failures.push({ kind: 'unrunnable-witness', at: witness.code, detail: 'no twin declares this code' });
      continue;
    }
    const { errorClass, text } = induceRuntime(witness);
    const routed = runtimeIndex.match({ name: errorClass, message: text });
    if (routed.outcome !== 'matched' || routed.entry.corpusEntryId !== twin.code) {
      failures.push({
        kind: 'not-inducible',
        at: twin.code,
        detail: `the real error this witness provoked routed as ${routed.outcome}${
          routed.outcome === 'matched' ? ` (${routed.entry.corpusEntryId})` : ''
        }, not a confirmed match to ${twin.code}: ${text}`,
      });
      continue;
    }
    inducedCodes.push(twin.code);
  }

  for (const witness of STATIC_WITNESSES) {
    const twin = corpus.twins.find((one) => one.code === witness.code);
    if (twin === undefined) {
      failures.push({ kind: 'unrunnable-witness', at: witness.code, detail: 'no twin declares this code' });
      continue;
    }
    await witness.verifyClaim();
    const positive = patternIndex.match({ name: 'SourceSnippet', message: witness.positiveSample });
    const miss = patternIndex.match({ name: 'SourceSnippet', message: witness.nearMiss });
    if (positive.outcome !== 'matched' || positive.entry.corpusEntryId !== twin.code) {
      failures.push({
        kind: 'not-inducible',
        at: twin.code,
        detail: `the positive sample "${witness.positiveSample}" routed as ${positive.outcome}, not a confirmed match to ${twin.code}`,
      });
      continue;
    }
    if (miss.outcome === 'matched') {
      failures.push({
        kind: 'not-inducible',
        at: twin.code,
        detail: `the near-miss "${witness.nearMiss}" matched anyway; the pattern is not precise enough`,
      });
      continue;
    }
    inducedCodes.push(twin.code);
  }

  return Object.freeze({
    directory: DIRECTORY,
    package: corpus.package,
    resolved: Object.freeze({ name: DIRECTORY, version: expressVersion() }),
    inducedCodes: Object.freeze(inducedCodes),
    verifiedFixes: Object.freeze([]),
    failures: Object.freeze(failures),
  });
}

const observed = await induceAll();

describe('the corpus catalogs exactly what it can induce, no more and no less', () => {
  it('names the real, installed express5 version this corpus induced against', () => {
    expect(expressVersion()).toMatch(/^5\.\d+\.\d+/);
  });

  it('catalogs nothing no witness provokes, and provokes nothing it does not catalog', () => {
    const cataloged = corpus.twins.map((twin) => twin.code).sort();
    const witnessed = [...RUNTIME_WITNESSES, ...STATIC_WITNESSES].map((witness) => witness.code).sort();

    expect(witnessed).toEqual(cataloged);
  });

  it('carries both fingerprint kinds', () => {
    const kinds = new Set(corpus.twins.map((twin) => twin.fingerprint.kind ?? 'runtime-error'));
    expect(kinds).toEqual(new Set(['runtime-error', 'static-pattern']));
  });
});

describe.each(RUNTIME_WITNESSES.map((witness) => [witness.code, witness] as const))(
  'the cataloged runtime-error failure %s',
  (code) => {
    it('really throws, against the real, installed express5', () => {
      const witness = RUNTIME_WITNESSES.find((one) => one.code === code);
      if (witness === undefined) throw new Error(`no witness for ${code}`);
      const result = induceRuntime(witness);
      expect(result.text.length).toBeGreaterThan(0);
    });
  },
);

describe.each(STATIC_WITNESSES.map((witness) => [witness.code, witness] as const))(
  'the cataloged static-pattern entry %s',
  (code) => {
    it('the real, live claim behind it still holds', async () => {
      const witness = STATIC_WITNESSES.find((one) => one.code === code);
      if (witness === undefined) throw new Error(`no witness for ${code}`);
      await expect(witness.verifyClaim()).resolves.not.toThrow();
    });
  },
);

describe('the corpus passes Submission Gate [29] with no folklore rejections', () => {
  it('induced every cataloged code, live, both kinds', () => {
    expect(observed.failures).toEqual([]);
    expect([...observed.inducedCodes].sort()).toEqual(corpus.twins.map((twin) => twin.code).sort());
  });

  it('passes every check the gate runs, with none reported not-run, and collides with none of the four prior corpora in either index', async () => {
    const result = runSubmissionGate({
      prId: 'express-corpus',
      corpora: [{ directory: DIRECTORY, source: corpus }],
      published: [
        { directory: 'ffmpeg', source: parse(FFMPEG_DIR) },
        { directory: 'openai-python', source: parse(OPENAI_PYTHON_DIR) },
        { directory: 'mcp-oauth', source: parse(MCP_OAUTH_DIR) },
        { directory: 'zod', source: parse(ZOD_DIR) },
      ],
      upstream: [observed],
      measure: await specMeter(),
    });

    expect(result.violations).toEqual([]);
    for (const check of GATE_CHECKS) expect([check, result.checks[check]]).toEqual([check, 'pass']);
    expect(result.pass).toBe(true);
  });
});
