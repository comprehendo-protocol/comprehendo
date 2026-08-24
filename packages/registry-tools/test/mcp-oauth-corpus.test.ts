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
import type { TruthFailure, UpstreamVerification } from '../src/gate-upstream.js';
import { induceAll, induceOne, indexOf, loadCorpus } from './helpers/http-induction.js';
import { SDK_VERSION, WITNESSES, requireRealSdk } from './helpers/mcp-oauth-witnesses.js';
import { type RealServer, startRealServer } from './helpers/mcp-oauth-server.js';
import { specMeter } from './helpers/spec-meter.js';
import { type CspPair, startCspPair } from './helpers/csp-form-action-server.js';
import { submitConsentForm } from './helpers/csp-form-action-witness.js';

const CORPUS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'mcp-oauth');
const FFMPEG_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'ffmpeg');
const OPENAI_PYTHON_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'openai-python');
const MONGODB_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'mongodb');
const ZOD_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'zod');
const TAILWIND_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'tailwindcss');
const EXPRESS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'express');
const NODE_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'node');
const DIRECTORY = 'mcp-oauth';

/**
 * The corpus's fifth twin is not HTTP-shaped (see `csp-form-action-server.ts`'s
 * own doc comment): its evidence is a real browser's `console` event, not an
 * SDK response body, so it is induced separately here rather than being
 * force-fit into `HttpWitness`, and merged into the one `UpstreamVerification`
 * the gate reads for this directory (`gate.ts#runSubmissionGate` takes the
 * FIRST entry matching a directory, never a union of several).
 */
const CSP_TWIN_CODE = 'MCP_OAUTH_CSP_BLOCKS_CONSENT_FORM';

const version = (): string => SDK_VERSION;

let corpus: CorpusSource;
let server: RealServer;
let observed: UpstreamVerification;
let cspVulnerable: CspPair;
let cspBlockedConsoleText: string;

beforeAll(async () => {
  requireRealSdk(); // fails loudly, naming what CI owes, if the SDK is missing
  corpus = loadCorpus(CORPUS_DIR);
  server = await startRealServer();
  const httpObserved = await induceAll(corpus, DIRECTORY, WITNESSES, server.baseUrl, version);

  // Real headless Chromium, real two-origin CSP block: `form-action 'self'`
  // alone, the vulnerable default, against a form whose real action targets
  // a different real origin.
  cspVulnerable = await startCspPair(() => "'self'");
  const blocked = await submitConsentForm(cspVulnerable.consentUrl);
  cspBlockedConsoleText = blocked.consoleErrors[0] ?? '';

  const index = indexOf(corpus);
  const match = index.match(cspBlockedConsoleText);
  const cspFailures: TruthFailure[] =
    match.outcome === 'matched' && match.entry.corpusEntryId === CSP_TWIN_CODE
      ? []
      : [
          {
            kind: match.outcome === 'ambiguous' ? 'misrouted' : 'not-inducible',
            at: CSP_TWIN_CODE,
            detail: `the real browser run's console output routed as ${match.outcome}, not matched to ${CSP_TWIN_CODE}`,
          },
        ];

  // `induceAll` (HTTP-shaped) reports the CSP twin as an unrunnable witness,
  // correctly, since `WITNESSES` supplies none for it; that is expected here,
  // not a real gap, because the browser run just above IS this twin's real
  // induction, so its own placeholder failure is dropped before merging.
  const httpFailures = httpObserved.failures.filter((failure) => failure.at !== CSP_TWIN_CODE);

  observed = Object.freeze({
    ...httpObserved,
    inducedCodes: Object.freeze(
      cspFailures.length === 0 ? [...httpObserved.inducedCodes, CSP_TWIN_CODE] : httpObserved.inducedCodes,
    ),
    failures: Object.freeze([...httpFailures, ...cspFailures]),
  });
});

afterAll(async () => {
  await server.close();
  await cspVulnerable.close();
});

describe('MCP_OAUTH_CSP_BLOCKS_CONSENT_FORM, the real browser-enforced twin', () => {
  it('really blocks the cross-origin submit and the browser really reports the cataloged message', () => {
    expect(cspBlockedConsoleText).toContain('violates the following Content Security Policy directive');
    expect(cspBlockedConsoleText).toContain('form-action');

    const index = indexOf(corpus);
    const match = index.match(cspBlockedConsoleText);
    expect(match.outcome).toBe('matched');
    expect(match.outcome === 'matched' ? match.entry.corpusEntryId : '').toBe(CSP_TWIN_CODE);
  });

  it('really stops blocking once the fix widens form-action to the real cross-origin target, proving the runbook, not just the failure', async () => {
    const fixed = await startCspPair((mcpUrl) => `'self' ${mcpUrl}`);
    try {
      const submitted = await submitConsentForm(fixed.consentUrl);
      expect(submitted.consoleErrors).toEqual([]);
      expect(submitted.landedOn).toBe(`${fixed.mcpUrl}/oauth/authorize`);
    } finally {
      await fixed.close();
    }
  });
});

describe('the corpus catalogs exactly what it can induce, no more and no less', () => {
  it('names the real SDK version this corpus induced against', () => {
    expect(version()).toBe('1.30.0');
  });

  it('catalogs nothing no witness provokes, and provokes nothing it does not catalog', () => {
    const cataloged = corpus.twins.map((twin) => twin.code).sort();
    // The four HTTP-shaped `WITNESSES` plus the one browser-shaped twin
    // induced separately above (`beforeAll`'s `cspVulnerable` run): together
    // they are every twin this corpus catalogs, no more, no less.
    const witnessed = [...WITNESSES.map((witness) => witness.code), CSP_TWIN_CODE].sort();

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

  it('passes every check the gate runs, with none reported not-run, and collides with none of the other corpora', async () => {
    const result = runSubmissionGate({
      prId: 'mcp-oauth-corpus',
      corpora: [{ directory: DIRECTORY, source: corpus }],
      published: [
        { directory: 'ffmpeg', source: loadCorpus(FFMPEG_DIR) },
        { directory: 'openai-python', source: loadCorpus(OPENAI_PYTHON_DIR) },
        { directory: 'mongodb', source: loadCorpus(MONGODB_DIR) },
        { directory: 'zod', source: loadCorpus(ZOD_DIR) },
        { directory: 'tailwindcss', source: loadCorpus(TAILWIND_DIR) },
        { directory: 'express', source: loadCorpus(EXPRESS_DIR) },
        { directory: 'node', source: loadCorpus(NODE_DIR) },
      ],
      upstream: [observed],
      measure: await specMeter(),
    });

    expect(result.violations).toEqual([]);
    for (const check of GATE_CHECKS) expect([check, result.checks[check]]).toEqual([check, 'pass']);
    expect(result.pass).toBe(true);
  });
});
