// mcp-oauth Corpus against CC4 Folklore Gate [26]: every cataloged twin
// induced against the REAL `@modelcontextprotocol/sdk` `mcpAuthRouter`,
// mounted on a real Express app, listening on a real ephemeral localhost
// port, with the same real `runSubmissionGate` a community corpus passes.
//
// Nothing here asserts that a shape looks plausible. Each test makes a real
// HTTP request against the real, running server (`mcp-oauth-server.ts`) and
// routes the real JSON response body through Fingerprint Index & Matcher
// [21]'s REAL index built from this corpus's own twins.
//
// A missing `@modelcontextprotocol/sdk` install fails this suite loudly: a
// green run that induced nothing is exactly the folklore CC4 exists to
// catch.

import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CorpusSource } from '../src/corpus-format.js';
import { runSubmissionGate } from '../src/gate.js';
import { GATE_CHECKS } from '../src/gate-result.js';
import type { UpstreamVerification } from '../src/gate-upstream.js';
import { induceAll, induceOne, indexOf, loadCorpus } from './helpers/http-induction.js';
import { SDK_VERSION, WITNESSES, requireRealSdk } from './helpers/mcp-oauth-witnesses.js';
import { type RealServer, startRealServer } from './helpers/mcp-oauth-server.js';
import { specMeter } from './helpers/spec-meter.js';

const CORPUS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'mcp-oauth');
const FFMPEG_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'ffmpeg');
const OPENAI_PYTHON_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'openai-python');
const DIRECTORY = 'mcp-oauth';

const version = (): string => SDK_VERSION;

let corpus: CorpusSource;
let server: RealServer;
let observed: UpstreamVerification;

beforeAll(async () => {
  requireRealSdk(); // fails loudly, naming what CI owes, if the SDK is missing
  corpus = loadCorpus(CORPUS_DIR);
  server = await startRealServer();
  observed = await induceAll(corpus, DIRECTORY, WITNESSES, server.baseUrl, version);
});

afterAll(async () => {
  await server.close();
});

describe('the corpus catalogs exactly what it can induce, no more and no less', () => {
  it('names the real SDK version this corpus induced against', () => {
    expect(version()).toBe('1.30.0');
  });

  it('catalogs nothing no witness provokes, and provokes nothing it does not catalog', () => {
    const cataloged = corpus.twins.map((twin) => twin.code).sort();
    const witnessed = WITNESSES.map((witness) => witness.code).sort();

    expect(witnessed).toEqual(cataloged);
  });
});

describe.each(WITNESSES.map((witness) => [witness.code, witness] as const))(
  'the cataloged failure %s',
  (code) => {
    it('really fails, really writes the cataloged JSON body, and really routes to itself', async () => {
      const index = indexOf(corpus);
      const witness = WITNESSES.find((one) => one.code === code);
      if (witness === undefined) throw new Error(`no witness for ${code}`);

      const induced = await induceOne(witness, index, server.baseUrl, version());

      expect(induced.status).toBe(400);
      expect(induced.outcome).toBe('matched');
      expect(induced.matched).toBe(code);
    });
  },
);

describe('the corpus passes Submission Gate [29] with no folklore rejections', () => {
  it('induced every cataloged code, live', () => {
    expect(observed.failures).toEqual([]);
    expect([...observed.inducedCodes].sort()).toEqual(corpus.twins.map((twin) => twin.code).sort());
    expect(observed.resolved?.version).toBe('1.30.0');
  });

  it('passes every check the gate runs, with none reported not-run, and collides with neither prior corpus', async () => {
    const result = runSubmissionGate({
      prId: 'mcp-oauth-corpus',
      corpora: [{ directory: DIRECTORY, source: corpus }],
      published: [
        { directory: 'ffmpeg', source: loadCorpus(FFMPEG_DIR) },
        { directory: 'openai-python', source: loadCorpus(OPENAI_PYTHON_DIR) },
      ],
      upstream: [observed],
      measure: await specMeter(),
    });

    expect(result.violations).toEqual([]);
    for (const check of GATE_CHECKS) expect([check, result.checks[check]]).toEqual([check, 'pass']);
    expect(result.pass).toBe(true);
  });
});
