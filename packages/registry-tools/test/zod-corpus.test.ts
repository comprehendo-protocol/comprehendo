// zod Corpus against CC4 Folklore Gate [26]: every cataloged twin induced
// against the REAL, installed `zod`, `runtime-error` twins by a real thrown
// error, `static-pattern` twins by a real, live-verified claim (see
// `helpers/zod-witnesses.ts` for what "induced" means for each kind), routed
// through Fingerprint Index & Matcher [21]'s REAL, kind-separated indices,
// with the same real `runSubmissionGate` a community corpus passes.
//
// This is the first corpus to carry BOTH fingerprint kinds, so it is also
// the first real proof that `buildFingerprintIndex` and
// `buildStaticPatternIndex` stay genuinely separate under the real
// Submission Gate [29] (`gate-fingerprint.ts`'s own two-index collision
// check), not merely in a unit test.

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
  induceRuntime,
  zodVersion,
} from './helpers/zod-witnesses.js';
import { specMeter } from './helpers/spec-meter.js';

const CORPUS_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'zod');
const FFMPEG_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'ffmpeg');
const OPENAI_PYTHON_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'openai-python');
const MCP_OAUTH_DIR = join(import.meta.dirname, '..', '..', '..', 'corpora', 'mcp-oauth');
const DIRECTORY = 'zod';

const corpus: CorpusSource = parse(CORPUS_DIR);

/**
 * `UpstreamVerification`, built by hand rather than through a shared
 * induction helper: `process-induction.ts` (spawn a process) and
 * `http-induction.ts` (a real HTTP round trip) both generalize a REAL
 * external boundary this corpus does not have, zod is a direct devDependency
 * of this very package, so induction here is the plainest form CC4 [26]
 * asks for, call it and observe. A `static-pattern` twin has no runtime
 * event to spawn or request, its own "induction" is `StaticWitness.verifyClaim`
 * (a real, live-checked assertion, `helpers/zod-witnesses.ts`); a twin only
 * enters `inducedCodes` here once that real check has actually passed, so
 * the folklore gate below (unmodified, kind-agnostic) is earning its
 * verdict honestly for both kinds, not being fed a shortcut.
 */
function induceAll(): UpstreamVerification {
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
    // The real caught error, routed through the corpus's OWN runtime-error
    // index the same way `comprehend(raw)` would: not assumed to match its
    // own twin, checked.
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
    // The real claim, checked live, right now. Throws (fails this whole
    // beforeAll/test) if the claim no longer holds against the real zod,
    // exactly the drift signal a runtime witness's mismatch already gives.
    witness.verifyClaim();
    // The pattern itself really matches its own positive sample and really
    // does not match its near-miss, against the corpus's own compiled
    // static-pattern index, not an assumption about the glob.
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
    resolved: Object.freeze({ name: DIRECTORY, version: zodVersion() }),
    inducedCodes: Object.freeze(inducedCodes),
    verifiedFixes: Object.freeze([]),
    failures: Object.freeze(failures),
  });
}

const observed = induceAll();

describe('the corpus catalogs exactly what it can induce, no more and no less', () => {
  it('names the real, installed zod version this corpus induced against', () => {
    expect(zodVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('catalogs nothing no witness provokes, and provokes nothing it does not catalog', () => {
    const cataloged = corpus.twins.map((twin) => twin.code).sort();
    const witnessed = [...RUNTIME_WITNESSES, ...STATIC_WITNESSES].map((witness) => witness.code).sort();

    expect(witnessed).toEqual(cataloged);
  });

  it('carries both fingerprint kinds, the first corpus to', () => {
    const kinds = new Set(corpus.twins.map((twin) => twin.fingerprint.kind ?? 'runtime-error'));
    expect(kinds).toEqual(new Set(['runtime-error', 'static-pattern']));
  });
});

describe.each(RUNTIME_WITNESSES.map((witness) => [witness.code, witness] as const))(
  'the cataloged runtime-error failure %s',
  (code) => {
    it('really throws, against the real, installed zod', () => {
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
    it('the real, live claim behind it still holds', () => {
      const witness = STATIC_WITNESSES.find((one) => one.code === code);
      if (witness === undefined) throw new Error(`no witness for ${code}`);
      expect(() => witness.verifyClaim()).not.toThrow();
    });
  },
);

describe('the corpus passes Submission Gate [29] with no folklore rejections', () => {
  it('induced every cataloged code, live, both kinds', () => {
    expect(observed.failures).toEqual([]);
    expect([...observed.inducedCodes].sort()).toEqual(corpus.twins.map((twin) => twin.code).sort());
  });

  it('passes every check the gate runs, with none reported not-run, and collides with none of the three prior corpora in either index', async () => {
    const result = runSubmissionGate({
      prId: 'zod-corpus',
      corpora: [{ directory: DIRECTORY, source: corpus }],
      published: [
        { directory: 'ffmpeg', source: parse(FFMPEG_DIR) },
        { directory: 'openai-python', source: parse(OPENAI_PYTHON_DIR) },
        { directory: 'mcp-oauth', source: parse(MCP_OAUTH_DIR) },
      ],
      upstream: [observed],
      measure: await specMeter(),
    });

    expect(result.violations).toEqual([]);
    for (const check of GATE_CHECKS) expect([check, result.checks[check]]).toEqual([check, 'pass']);
    expect(result.pass).toBe(true);
  });
});
