// ffmpeg Corpus [32]: the flagship corpus, judged by the real tooling.
//
// `corpora/ffmpeg/` is hand-authored in Corpus Format [28]'s AUTHORING shape
// rather than generated, because Corpus Generator [17]'s scanner reads a target
// package's TypeScript exports and throw sites and ffmpeg has neither: it is a
// program, not a module. What must NOT differ is the judging, so every check
// below runs the real function over the real directory: 28's `parse`,
// `validate` and `pack`, Docs Engine [13]'s `createDocs`, Twin Builder [12]'s
// `createTwinBuilder`, Fingerprint Index & Matcher [21]'s index, and Submission
// Gate [29]'s `runSubmissionGate` with CC5's real tiktoken-class meter.
//
// The evidence the gate's folklore half reads is produced by
// `ffmpeg-induction.test.ts`'s own discipline: a real run of the real binary,
// per entry. Nothing here declares coverage; `induceAll` observes it.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  CORPUS_ARTIFACT,
  CORPUS_DESCRIPTOR_KEY,
  corpusDescriptor,
  pack,
  readPackedCorpus,
  serializeCorpus,
  validate,
} from '../src/corpus-format.js';
import type { CorpusSource } from '../src/corpus-format.js';
import type { BudgetMeter, BudgetRecord, BudgetScope } from '../src/gate-budget.js';
import { runSubmissionGate } from '../src/gate.js';
import { GATE_CHECKS } from '../src/gate-result.js';
import type { UpstreamVerification } from '../src/gate-upstream.js';
import { coreModule } from './helpers/authored-corpus.js';
import { requireFfmpeg } from './helpers/ffmpeg-cli.js';
import {
  FFMPEG_DIRECTORY,
  indexOf,
  induceAll,
  loadFfmpegCorpus,
} from './helpers/ffmpeg-corpus.js';

/** The CC5 budget harness itself, not a copy of its numbers. */
async function specMeter(): Promise<BudgetMeter> {
  const module = (await import(
    /* @vite-ignore */ pathToFileURL(
      join(import.meta.dirname, '..', '..', 'spec', 'kit', 'budget', 'measure.js'),
    ).href
  )) as { measureScope: (scope: string, payload: unknown) => BudgetRecord };
  return (scope: BudgetScope, payload: unknown): BudgetRecord => module.measureScope(scope, payload);
}

let corpus: CorpusSource;
let observed: UpstreamVerification;

beforeAll(() => {
  requireFfmpeg();
  corpus = loadFfmpegCorpus();
  observed = induceAll(corpus);
}, 300_000);

describe('the corpus reads through Corpus Format [28]s own parser', () => {
  it('is a corpus FOR ffmpeg, authored by the registry tier', () => {
    expect(corpus.package).toBe(FFMPEG_DIRECTORY);
    expect(corpus.provider).toBe('@comprehendo/ffmpeg');
    expect(corpus.version).toMatch(/^\d+\.\d+/);
  });

  it('carries one topic per file, every one advertised by the index', () => {
    expect(corpus.strayTopicFiles).toEqual([]);
    for (const topic of corpus.topics) {
      expect(topic.declaredTopics).toEqual([topic.topic]);
      expect(topic.file).toBe(`topics/${topic.topic}.md`);
    }
    expect(corpus.topics.length).toBeGreaterThanOrEqual(5);
  });

  it('declares the ffmpeg option surface its fixes call into', () => {
    expect(corpus.declaredSchema?.surface).toBe('ffmpeg');
    expect(corpus.declaredSchema?.operations).toContain('-vf');
    expect(corpus.declaredSchema?.operations).toContain('-map');
    expect(corpus.declaredSchema?.operations).toContain('-c:v');
  });

  it('fingerprints stderr text, never an error class the CLI cannot carry', () => {
    for (const twin of corpus.twins) {
      expect(twin.fingerprint.errorClass).toBeUndefined();
      expect(twin.fingerprint.messagePattern).toBeTruthy();
      expect(twin.fingerprint.kind).toBe('runtime-error');
    }
  });
});

describe('the corpus passes Corpus Format [28]s own gate', () => {
  it('validates with zero violations', () => {
    expect(validate(corpus)).toEqual([]);
  });

  it('packs into one runtime artifact that its own loader reads back', () => {
    const packed = pack(corpus);

    expect(readPackedCorpus(JSON.parse(serializeCorpus(packed)))).toEqual(packed);
    expect(corpusDescriptor(packed)).toEqual({
      target: 'ffmpeg',
      format: 1,
      artifact: CORPUS_ARTIFACT,
    });
    expect(CORPUS_DESCRIPTOR_KEY).toBe('comprehendoCorpus');
    expect(packed.fingerprints.map((entry) => entry.corpusEntryId).sort()).toEqual(
      corpus.twins.map((twin) => twin.code).sort(),
    );
  });

  it('has teeth: an apply naming an undeclared option is refused', () => {
    const escaping: CorpusSource = {
      ...corpus,
      fixes: {
        ...corpus.fixes,
        [corpus.twins[0]?.id ?? '']: [
          { title: 'an option this provider never declared', apply: { '-vsync': '0' } },
        ],
      },
    };

    const violations = validate(escaping);

    expect(violations.map((found) => found.reason)).toContain('schema-escaping-fix');
    expect(() => pack(escaping)).toThrow(/never packed/);
  });
});

describe('the disposition rule: fences and heals outrank runbooks', () => {
  const executable = (): readonly { readonly code: string; readonly title: string }[] =>
    corpus.twins.flatMap((twin) =>
      (corpus.fixes[twin.id] ?? [])
        .filter((fix) => fix.apply !== undefined)
        .map((fix) => ({ code: twin.code, title: fix.title })),
    );

  it('carries at least one fence and at least one heal, not runbooks exclusively', () => {
    const titles = executable().map((fix) => fix.title);

    expect(titles.filter((title) => title.startsWith('Fence:')).length).toBeGreaterThanOrEqual(1);
    expect(titles.filter((title) => title.startsWith('Heal:')).length).toBeGreaterThanOrEqual(1);
  });

  it('gives every cataloged failure at least one fix, and a docs pointer that resolves', () => {
    const topics = new Set(corpus.topics.map((topic) => topic.topic));
    for (const twin of corpus.twins) {
      const fixes = corpus.fixes[twin.id] ?? [];
      expect(fixes.length).toBeGreaterThan(0);
      expect(topics.has(twin.docs)).toBe(true);
      expect(fixes.some((fix) => fix.docs !== undefined)).toBe(true);
    }
  });

  it('names a runbook fix a runbook, so a disposition survives into the artifact', () => {
    const inert = corpus.twins.flatMap((twin) =>
      (corpus.fixes[twin.id] ?? []).filter((fix) => fix.apply === undefined),
    );

    expect(inert.length).toBeGreaterThan(0);
    for (const fix of inert) expect(fix.title).toMatch(/^Runbook:/);
  });
});

describe('the corpus answers through the real runtime surfaces', () => {
  it('answers docs() and docs(topic) through Docs Engine [13]s own loader', async () => {
    const packed = pack(corpus);
    const docs = (await coreModule('docs')) as {
      parsePackedCorpus: (raw: unknown) => unknown;
      createDocs: (packed: unknown, options: unknown) => (query?: string) => Record<string, unknown>;
    };

    const surface = docs.createDocs(docs.parsePackedCorpus(packed.docs), {
      sink: (): void => undefined,
    });

    expect(surface()['topics']).toEqual(corpus.topics.map((topic) => topic.topic));
    expect(surface('scaling')['topic']).toBe('scaling');
    expect(String(surface('scaling')['summary'])).toContain('scale');
  });

  it('turns real ffmpeg stderr into the cataloged twin through the real builder', async () => {
    const packed = pack(corpus);
    const twin = (await coreModule('twin')) as {
      createTwinBuilder: (catalog: unknown) => {
        twinFor: (code: string, raw: unknown) => Record<string, unknown>;
      };
    };

    // The exact text the real binary wrote, quoted from the induction record.
    const raw =
      "[libx264 @ 0x5997f2536b00] width not divisible by 2 (721x720)\nError initializing output stream 0:0 -- Error while opening encoder for output stream #0:0\n";
    const match = indexOf(corpus).match(raw);

    expect(match.outcome).toBe('matched');
    if (match.outcome !== 'matched') return;
    const built = twin.createTwinBuilder(packed.twins).twinFor(match.entry.corpusEntryId, raw);

    expect(built['code']).toBe('FFMPEG_ODD_DIMENSION');
    expect(String(built['reason'])).not.toContain('width not divisible by 2');
    expect((built['fixes'] as { title: string }[])[0]?.title).toMatch(/^Fence:/);
  });

  it('answers UNSTRUCTURED for ffmpeg output the corpus does not catalog', () => {
    expect(indexOf(corpus).match('[mp4 @ 0x0] some entirely other ffmpeg complaint').outcome).toBe(
      'miss',
    );
  });
});

describe('the corpus passes Submission Gate [29] with no folklore rejections', () => {
  it('induced every cataloged code and proved every executable fix, live', () => {
    expect(observed.failures).toEqual([]);
    expect([...observed.inducedCodes].sort()).toEqual(corpus.twins.map((twin) => twin.code).sort());
    expect(observed.verifiedFixes.length).toBeGreaterThan(0);
    expect(observed.resolved?.version).toMatch(/^ffmpeg version /);
  });

  it('passes every check the gate runs, with none reported not-run', async () => {
    const result = runSubmissionGate({
      prId: 'ffmpeg-corpus-32',
      corpora: [{ directory: FFMPEG_DIRECTORY, source: corpus }],
      upstream: [observed],
      measure: await specMeter(),
    });

    expect(result.violations).toEqual([]);
    for (const check of GATE_CHECKS) expect([check, result.checks[check]]).toEqual([check, 'pass']);
    expect(result.pass).toBe(true);
    expect(result.publishable).toBe(true);
  });

  it('has teeth: dropping one induction turns the folklore check red by name', async () => {
    const partial: UpstreamVerification = {
      ...observed,
      inducedCodes: observed.inducedCodes.filter((code) => code !== 'FFMPEG_ODD_DIMENSION'),
      verifiedFixes: observed.verifiedFixes.filter(
        (key) => !key.startsWith('FFMPEG_ODD_DIMENSION'),
      ),
    };

    const result = runSubmissionGate({
      prId: 'ffmpeg-corpus-32-mutated',
      corpora: [{ directory: FFMPEG_DIRECTORY, source: corpus }],
      upstream: [partial],
      measure: await specMeter(),
    });

    expect(result.checks.folklore).toBe('fail');
    expect(result.violations.join('\n')).toContain('FFMPEG_ODD_DIMENSION');
    expect(result.pass).toBe(false);
  });
});
