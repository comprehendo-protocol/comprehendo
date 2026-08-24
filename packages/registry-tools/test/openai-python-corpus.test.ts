// openai-python Corpus against CC4 Folklore Gate [26]: every cataloged twin
// induced against the REAL installed package, and the same real
// `runSubmissionGate` a community corpus passes, with no tier parameter to
// special-case on.
//
// Nothing here asserts that a shape looks plausible. Each test spawns a real
// Python interpreter with the really-installed `openai` package, reads the
// traceback it really wrote, and routes it through Fingerprint Index &
// Matcher [21]'s REAL index built from this corpus's own twins.
//
// A missing interpreter, or a missing `openai` install, fails this suite
// loudly: a green run that induced nothing is exactly the folklore CC4
// exists to catch.

import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CorpusSource } from '../src/corpus-format.js';
import { runSubmissionGate } from '../src/gate.js';
import { GATE_CHECKS } from '../src/gate-result.js';
import type { UpstreamVerification } from '../src/gate-upstream.js';
import { induceAll, induceOne, indexOf, loadCorpus } from './helpers/process-induction.js';
import { PYTHON, WITNESSES, openaiVersion } from './helpers/openai-python-witnesses.js';
import { specMeter } from './helpers/spec-meter.js';

const CORPUS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'openai-python');
const DIRECTORY = 'openai-python';

let corpus: CorpusSource;
let observed: UpstreamVerification;

beforeAll(() => {
  openaiVersion(); // fails loudly, naming what CI owes, if Python/openai is missing
  corpus = loadCorpus(CORPUS_DIR);
  observed = induceAll(corpus, DIRECTORY, WITNESSES, () => [], openaiVersion);
});

describe('the corpus catalogs exactly what it can induce, no more and no less', () => {
  it('is the real interpreter, and names which openai version it induced against', () => {
    expect(PYTHON.length).toBeGreaterThan(0);
    expect(openaiVersion()).toMatch(/^\d+\.\d+/);
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
      const version = openaiVersion();
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
      prId: 'openai-python-corpus',
      corpora: [{ directory: DIRECTORY, source: corpus }],
      upstream: [observed],
      measure: await specMeter(),
    });

    expect(result.violations).toEqual([]);
    for (const check of GATE_CHECKS) expect([check, result.checks[check]]).toEqual([check, 'pass']);
    expect(result.pass).toBe(true);
  });
});
