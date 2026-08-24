// node Corpus against CC4 Folklore Gate [26]: every cataloged twin induced
// against the REAL `node` binary, and the same real `runSubmissionGate` a
// community corpus passes, with no tier parameter to special-case on.
//
// Nothing here asserts that a shape looks plausible. Each test spawns a
// real `node` process against real script files, reads what it really
// wrote to stderr, and routes it through Fingerprint Index & Matcher [21]'s
// REAL index built from this corpus's own twins.
//
// A missing `node` binary fails this suite loudly: a green run that
// induced nothing is exactly the folklore CC4 exists to catch (unlikely in
// practice, since this test runner is itself running under node, but the
// precondition is checked for real anyway, matching every other corpus's
// own discipline).

import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CorpusSource } from '../src/corpus-format.js';
import { runSubmissionGate } from '../src/gate.js';
import { GATE_CHECKS } from '../src/gate-result.js';
import type { UpstreamVerification } from '../src/gate-upstream.js';
import { induceAll, induceOne, indexOf, loadCorpus } from './helpers/process-induction.js';
import { NODE, WITNESSES, nodeVersion } from './helpers/node-witnesses.js';
import { specMeter } from './helpers/spec-meter.js';

const CORPUS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'node');
const DIRECTORY = 'node';

let corpus: CorpusSource;
let observed: UpstreamVerification;

beforeAll(() => {
  nodeVersion(); // fails loudly, naming what CI owes, if node is missing
  corpus = loadCorpus(CORPUS_DIR);
  observed = induceAll(corpus, DIRECTORY, WITNESSES, () => [], nodeVersion);
});

describe('the corpus catalogs exactly what it can induce, no more and no less', () => {
  it('is the real runtime, and names which node version it induced against', () => {
    expect(NODE.length).toBeGreaterThan(0);
    expect(nodeVersion()).toMatch(/^\d+\.\d+/);
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
    it('really fails, really writes the cataloged text, and really routes to itself', () => {
      const version = nodeVersion();
      const index = indexOf(corpus);
      const witness = WITNESSES.find((one) => one.code === code);
      if (witness === undefined) throw new Error(`no witness for ${code}`);

      const induced = induceOne(witness, index, version);

      expect(induced.status).not.toBe(0);
      expect(induced.outcome).toBe('matched');
      expect(induced.matched).toBe(code);
    });
  },
);

describe('the corpus passes Submission Gate [29] with no folklore rejections', () => {
  it('induced every cataloged code, live', () => {
    expect(observed.failures).toEqual([]);
    expect([...observed.inducedCodes].sort()).toEqual(corpus.twins.map((twin) => twin.code).sort());
    expect(observed.resolved?.version).toMatch(/^\d+\.\d+/);
  });

  it('passes every check the gate runs, with none reported not-run', async () => {
    const result = runSubmissionGate({
      prId: 'node-corpus',
      corpora: [{ directory: DIRECTORY, source: corpus }],
      upstream: [observed],
      measure: await specMeter(),
    });

    expect(result.violations).toEqual([]);
    for (const check of GATE_CHECKS) expect([check, result.checks[check]]).toEqual([check, 'pass']);
    expect(result.pass).toBe(true);
  });
});
