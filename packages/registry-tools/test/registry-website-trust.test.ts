// Registry Website [40] against Submission Gate [29]'s mandatory
// `verifyAgainstUpstream` contract, satisfied TRANSITIVELY.
//
// The website never calls `verifyAgainstUpstream`: it renders published
// registry contents and induces nothing. What it DOES do is make a public
// trust claim, on comprehendo.dev, about a corpus somebody else's CI judged,
// and that is where the contract bites. The rule this suite holds it to is
// Owner Endorsement [30]'s, in the same shape and for the same reason: no rung
// above `community` and no "published" badge is reachable unless the gate
// ruling the site is rendering really carries `registryTruth` and `folklore`
// as `pass`, read off the check outcomes directly rather than off the
// `publishable` summary flag beside them (Scoped Publisher [31]'s own rule,
// and its `UPSTREAM_CHECKS` constant is what the site reads).
//
// EVERY GATE RESULT BELOW IS REAL. `runSubmissionGate` is really run over the
// real `corpora/ffmpeg/` corpus, once with the real induction ffmpeg Corpus
// [32] performs against the real binary and the spec kit's real budget meter
// (all eleven checks pass), and once with no upstream observation at all
// (`registryTruth` really reads `not-run`). The one doctored value in this
// file is the last case's, and it is doctored on purpose: a ruling claiming
// `pass: true` beside an unverified corpus is exactly the threat CC11 [25]
// names, and the site must buy nothing from it.
//
// @see .mdd/docs/40-registry-website.md

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import type { CorpusSource, PackedCorpus } from '../src/corpus-format.js';
import { pack } from '../src/corpus-format.js';
import { corpusDigest } from '../src/endorsement-digest.js';
import type { BudgetMeter, BudgetRecord, BudgetScope } from '../src/gate-budget.js';
import { runSubmissionGate } from '../src/gate.js';
import type { GateResult } from '../src/gate.js';
import type { UpstreamVerification } from '../src/gate-upstream.js';
import { requireFfmpeg } from './helpers/ffmpeg-cli.js';
import { FFMPEG_DIRECTORY, induceAll, loadFfmpegCorpus } from './helpers/ffmpeg-corpus.js';

/** The site's own model, loaded the way 35's suite loads a script: by URL. */
const ROOT = join(import.meta.dirname, '..', '..', '..');

interface CorpusListing {
  readonly directory: string;
  readonly trust: 'community' | 'endorsed' | 'native';
  readonly published: boolean;
  readonly verifiedAgainstUpstream: boolean;
  readonly reasons: readonly string[];
}

interface SiteRegistry {
  listingOf: (entry: {
    directory: string;
    corpus: CorpusSource;
    packed: PackedCorpus;
    ruling?: { gate: GateResult; manifest?: unknown; approvers?: readonly string[] };
  }) => CorpusListing;
}

const siteRegistry = async (): Promise<SiteRegistry> =>
  (await import(
    /* @vite-ignore */ pathToFileURL(join(ROOT, 'site', 'src', 'registry.ts')).href
  )) as SiteRegistry;

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
let packed: PackedCorpus;
let observed: UpstreamVerification;
let verified: GateResult;
let unverified: GateResult;
let site: SiteRegistry;

beforeAll(async () => {
  requireFfmpeg();
  corpus = loadFfmpegCorpus();
  packed = pack(corpus);
  observed = induceAll(corpus);
  verified = runSubmissionGate({
    prId: 'site-40-verified',
    corpora: [{ directory: FFMPEG_DIRECTORY, source: corpus }],
    upstream: [observed],
    measure: await specMeter(),
  });
  unverified = runSubmissionGate({
    prId: 'site-40-unverified',
    corpora: [{ directory: FFMPEG_DIRECTORY, source: corpus }],
    measure: await specMeter(),
  });
  site = await siteRegistry();
});

const listing = (gate: GateResult | undefined, manifest?: unknown): CorpusListing =>
  site.listingOf({
    directory: FFMPEG_DIRECTORY,
    corpus,
    packed,
    ...(gate === undefined ? {} : { ruling: { gate, ...(manifest === undefined ? {} : { manifest }) } }),
  });

describe('the gate runs this site depends on are real', () => {
  it('passes every check with the real induction, and reports registryTruth not-run without it', () => {
    expect(verified.checks.registryTruth).toBe('pass');
    expect(verified.checks.folklore).toBe('pass');
    expect(verified.pass).toBe(true);
    expect(verified.publishable).toBe(true);
    expect(unverified.checks.registryTruth).toBe('not-run');
    expect(unverified.checks.folklore).toBe('not-run');
  });
});

describe('the site publishes nothing verifyAgainstUpstream did not verify', () => {
  it('refuses published and every rung above community when verifyAgainstUpstream never ran', () => {
    const row = listing(unverified);

    expect(row.trust).toBe('community');
    expect(row.published).toBe(false);
    expect(row.verifiedAgainstUpstream).toBe(false);
    expect(row.reasons.join('\n')).toContain('registryTruth');
    expect(row.reasons.join('\n')).toContain('verifyAgainstUpstream');
  });

  it('refuses the same way when no gate ruling accompanies the corpus at all', () => {
    const row = listing(undefined);

    expect(row.trust).toBe('community');
    expect(row.published).toBe(false);
    expect(row.verifiedAgainstUpstream).toBe(false);
  });

  it('publishes a verified corpus, at community when its owner declared nothing', () => {
    const row = listing(verified);

    expect(row.verifiedAgainstUpstream).toBe(true);
    expect(row.published).toBe(true);
    expect(row.trust).toBe('community');
  });

  it('reads the endorsed rung off the real endorsement decision, never off itself', () => {
    const digest = corpusDigest(corpus).digest;
    expect(digest).toBeTypeOf('string');
    const row = listing(verified, {
      name: FFMPEG_DIRECTORY,
      version: '4.4.2',
      comprehendo: { corpus: digest },
    });

    expect(row.trust).toBe('endorsed');
    expect(row.published).toBe(true);
  });

  it('buys nothing from a ruling that claims to pass while reporting registryTruth not-run', () => {
    const doctored: GateResult = {
      ...verified,
      checks: { ...verified.checks, registryTruth: 'not-run' },
    };
    const row = listing(doctored, {
      name: FFMPEG_DIRECTORY,
      version: '4.4.2',
      comprehendo: { corpus: corpusDigest(corpus).digest },
    });

    expect(doctored.pass).toBe(true);
    expect(doctored.publishable).toBe(true);
    expect(row.trust).toBe('community');
    expect(row.published).toBe(false);
    expect(row.verifiedAgainstUpstream).toBe(false);
  });
});
