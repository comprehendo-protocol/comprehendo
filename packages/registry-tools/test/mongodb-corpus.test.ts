// mongodb Corpus against CC4 Folklore Gate [26]: every cataloged twin
// induced against a REAL, disposable MongoDB server (`mongo-server.ts`,
// real Docker, real teardown) via the real, installed `mongodb` native
// driver, `runtime-error` twins by a real thrown error, `static-pattern`
// twins by a real, live-verified claim against the same real server, routed
// through Fingerprint Index & Matcher [21]'s REAL, kind-separated indices,
// with the same real `runSubmissionGate` a community corpus passes.
//
// A missing Docker (or a Docker daemon that cannot pull `mongo:7`) fails
// this suite loudly rather than skipping it: a green run that induced
// nothing is exactly the folklore CC4 exists to catch.

import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
  induceRuntime,
  mongodbVersion,
} from './helpers/mongodb-witnesses.js';
import { startRealMongo, type RealMongo } from './helpers/mongo-server.js';
import { specMeter } from './helpers/spec-meter.js';

const CORPUS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'mongodb');
const FFMPEG_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'ffmpeg');
const OPENAI_PYTHON_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'openai-python');
const MCP_OAUTH_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'mcp-oauth');
const ZOD_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'zod');
const TAILWIND_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'tailwindcss');
const EXPRESS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'express');
const NODE_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'node');
const DIRECTORY = 'mongodb';

const corpus: CorpusSource = parse(CORPUS_DIR);

let mongo: RealMongo;
let observed: UpstreamVerification;

/**
 * Every cataloged claim checked against the real server, as the
 * `UpstreamVerification` the gate reads. Same shape `zod-corpus.test.ts`
 * already established for a two-kind corpus, adapted for a real external
 * dependency (a real server, not a same-process import) the way
 * `mcp-oauth-corpus.test.ts`'s own `http-induction.ts` already generalized
 * induction to reach.
 */
async function induceAll(uri: string): Promise<UpstreamVerification> {
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
    const { errorClass, text } = await induceRuntime(witness, uri);
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
    await witness.verifyClaim(uri);
    const positive = patternIndex.match({ name: 'SourceSnippet', message: witness.positiveSample });
    const miss = patternIndex.match({ name: 'SourceSnippet', message: witness.nearMiss });
    if (positive.outcome !== 'matched' || positive.entry.corpusEntryId !== twin.code) {
      failures.push({
        kind: 'not-inducible',
        at: twin.code,
        detail: `the positive sample routed as ${positive.outcome}, not a confirmed match to ${twin.code}`,
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
    resolved: Object.freeze({ name: DIRECTORY, version: mongodbVersion() }),
    inducedCodes: Object.freeze(inducedCodes),
    verifiedFixes: Object.freeze([]),
    failures: Object.freeze(failures),
  });
}

beforeAll(async () => {
  mongo = await startRealMongo();
  observed = await induceAll(mongo.uri);
}, 60_000);

afterAll(() => {
  mongo.stop();
});

describe('the corpus catalogs exactly what it can induce, no more and no less', () => {
  it('names the real, installed mongodb driver version this corpus induced against', () => {
    expect(mongodbVersion()).toMatch(/^\d+\.\d+\.\d+/);
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
    it('really throws, against a real, running MongoDB', async () => {
      const witness = RUNTIME_WITNESSES.find((one) => one.code === code);
      if (witness === undefined) throw new Error(`no witness for ${code}`);
      const result = await induceRuntime(witness, mongo.uri);
      expect(result.text.length).toBeGreaterThan(0);
    });
  },
);

describe.each(STATIC_WITNESSES.map((witness) => [witness.code, witness] as const))(
  'the cataloged static-pattern entry %s',
  (code) => {
    it('the real, live claim behind it still holds against a real MongoDB', async () => {
      const witness = STATIC_WITNESSES.find((one) => one.code === code);
      if (witness === undefined) throw new Error(`no witness for ${code}`);
      await expect(witness.verifyClaim(mongo.uri)).resolves.not.toThrow();
    });
  },
);

describe('the corpus passes Submission Gate [29] with no folklore rejections', () => {
  it('induced every cataloged code, live, both kinds', () => {
    expect(observed.failures).toEqual([]);
    expect([...observed.inducedCodes].sort()).toEqual(corpus.twins.map((twin) => twin.code).sort());
  });

  it('passes every check the gate runs, with none reported not-run, and collides with none of the prior corpora in either index', async () => {
    const result = runSubmissionGate({
      prId: 'mongodb-corpus',
      corpora: [{ directory: DIRECTORY, source: corpus }],
      published: [
        { directory: 'ffmpeg', source: parse(FFMPEG_DIR) },
        { directory: 'openai-python', source: parse(OPENAI_PYTHON_DIR) },
        { directory: 'mcp-oauth', source: parse(MCP_OAUTH_DIR) },
        { directory: 'zod', source: parse(ZOD_DIR) },
        { directory: 'tailwindcss', source: parse(TAILWIND_DIR) },
        { directory: 'express', source: parse(EXPRESS_DIR) },
        { directory: 'node', source: parse(NODE_DIR) },
      ],
      upstream: [observed],
      measure: await specMeter(),
    });

    expect(result.violations).toEqual([]);
    for (const check of GATE_CHECKS) expect([check, result.checks[check]]).toEqual([check, 'pass']);
    expect(result.pass).toBe(true);
  });
});
