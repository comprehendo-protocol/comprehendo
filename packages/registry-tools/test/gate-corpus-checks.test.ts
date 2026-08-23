// Submission Gate [29]: the checks that read the corpus itself, and the gate
// result they add up to.
//
// The schema-bound-fix and docs-pointer checks are Corpus Format [28]'s REAL
// `validate`, partitioned into the doc's check names rather than reimplemented;
// the fingerprint lint is Fingerprint Index & Matcher [21]'s REAL
// `buildFingerprintIndex` over one index built from every corpus in the PR
// (the way Router & Precedence [22] combines them), so a fingerprint two
// corpora both claim is visible as ambiguity; and the budget gate is
// `packages/spec/kit/budget`'s REAL tiktoken-class meter, loaded here the same
// way these suites load core, not a character-count proxy.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { pack } from '../src/corpus-format.js';
import { fingerprintFindings, fingerprintsOf } from '../src/gate-fingerprint.js';
import { budgetFindings } from '../src/gate-budget.js';
import type { BudgetMeter, BudgetRecord, BudgetScope } from '../src/gate-budget.js';
import { GATE_CHECKS } from '../src/gate-result.js';
import { runSubmissionGate } from '../src/gate.js';
import { verifyAgainstUpstream } from '../src/gate-upstream.js';
import type { UpstreamVerification } from '../src/gate-upstream.js';
import {
  EMPTY_INPUT_WITNESS,
  NO_PREFIX_WITNESS,
  cleanAll,
  fixture,
  installTarget,
} from './helpers/gate-fixture.js';
import type { Fixture } from './helpers/gate-fixture.js';

afterEach(cleanAll);

/** The CC5 budget harness itself, not a copy of its numbers. */
async function specMeter(): Promise<BudgetMeter> {
  const module = (await import(
    /* @vite-ignore */ pathToFileURL(
      join(import.meta.dirname, '..', '..', 'spec', 'kit', 'budget', 'measure.js'),
    ).href
  )) as { measureScope: (scope: string, payload: unknown) => BudgetRecord };
  return (scope: BudgetScope, payload: unknown): BudgetRecord => module.measureScope(scope, payload);
}

const coverage = async (made: Fixture): Promise<UpstreamVerification> =>
  verifyAgainstUpstream({
    corpus: made.source(),
    directory: made.name,
    installRoot: installTarget(made),
    witnesses: [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS],
  });

const failed = (checks: Readonly<Record<string, string>>): readonly string[] =>
  Object.entries(checks)
    .filter(([, outcome]) => outcome !== 'pass')
    .map(([name]) => name)
    .sort();

describe('the gate reuses 28 validate rather than reimplementing it', () => {
  it('reports an apply escaping the declared schema under schemaBoundFix', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      fixes: Object.fromEntries(
        Object.entries(corpus.fixes).map(([id, list]) => [
          id,
          list.map((fix) => ({ ...fix, apply: { dropEverything: ['*'] } })),
        ]),
      ),
    }));

    const result = runSubmissionGate({ prId: 'pr-1', corpora: [made.submission()] });

    expect(result.checks.schemaBoundFix).toBe('fail');
    expect(result.violations.join('\n')).toContain('dropEverything');
  });

  it('reports a dangling docs pointer under docsPointerIntegrity', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      fixes: Object.fromEntries(
        Object.entries(corpus.fixes).map(([id, list]) => [
          id,
          list.map((fix) => ({ ...fix, docs: 'no-such-topic' })),
        ]),
      ),
    }));

    const result = runSubmissionGate({ prId: 'pr-1', corpora: [made.submission()] });

    expect(result.checks.docsPointerIntegrity).toBe('fail');
    expect(result.checks.schemaBoundFix).toBe('pass');
  });

  it('reports a stub-bearing corpus under corpusFormat and never marks it publishable', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      twins: corpus.twins.map((twin) => ({ ...twin, reason: 'status: stub' })),
    }));

    const result = runSubmissionGate({ prId: 'pr-1', corpora: [made.submission()] });

    expect(result.checks.corpusFormat).toBe('fail');
    expect(result.publishable).toBe(false);
    expect(result.merge.botMergeEligible).toBe(false);
  });
});

describe('the fingerprint lint runs over ONE index, not one per corpus', () => {
  it('compiles exactly the fingerprints 28 packs, so the two never drift', async () => {
    const made = await fixture();

    expect(fingerprintsOf(made.source())).toEqual(pack(made.source()).fingerprints);
  });

  it('passes two corpora whose fingerprints differ', async () => {
    const one = await fixture('toy-encoder');
    const two = await fixture('toy-tagger');

    expect(fingerprintFindings([one.submission(), two.submission()])).toEqual([]);
  });

  it('names both packages when two corpora claim the same fingerprint', async () => {
    const one = await fixture('toy-encoder');
    const two = await fixture('toy-tagger');
    await two.rewrite((corpus) => ({
      ...corpus,
      twins: corpus.twins.map((twin) => ({
        ...twin,
        fingerprint: {
          ...(twin['fingerprint'] as Record<string, unknown>),
          message_pattern: String(
            (twin['fingerprint'] as Record<string, unknown>)['message_pattern'],
          ).replace('toy-tagger', 'toy-encoder'),
        },
      })),
    }));

    const found = fingerprintFindings([one.submission(), two.submission()]);
    const said = found.map((entry) => entry.message).join('\n');

    expect(found.length).toBeGreaterThan(0);
    expect(said).toContain('toy-encoder');
    expect(said).toContain('toy-tagger');
  });

  it('sees a collision with a corpus already published, not only inside the PR', async () => {
    const submitted = await fixture('toy-tagger');
    const onMain = await fixture('toy-encoder');
    await submitted.rewrite((corpus) => ({
      ...corpus,
      twins: corpus.twins.map((twin) => ({
        ...twin,
        fingerprint: {
          ...(twin['fingerprint'] as Record<string, unknown>),
          message_pattern: String(
            (twin['fingerprint'] as Record<string, unknown>)['message_pattern'],
          ).replace('toy-tagger', 'toy-encoder'),
        },
      })),
    }));

    const result = runSubmissionGate({
      prId: 'pr-1',
      corpora: [submitted.submission()],
      published: [onMain.submission()],
    });

    expect(result.checks.fingerprintLint).toBe('fail');
  });
});

describe('the budget gate charges the corpus what it really costs', () => {
  it('passes the authored corpus under the real CC5 meter', async () => {
    const made = await fixture();

    expect(budgetFindings(pack(made.source()), made.name, await specMeter())).toEqual([]);
  });

  it('fails a topic over the topic budget, naming the topic and the count', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      topics: corpus.topics.map((topic) =>
        topic['topic'] === 'encode'
          ? {
              ...topic,
              summary: `${String(topic['summary'])} ${'The wire format is a decimal length prefix followed by a colon and the payload. '.repeat(120)}`,
            }
          : topic,
      ),
    }));

    const found = budgetFindings(pack(made.source()), made.name, await specMeter());

    expect(found.length).toBe(1);
    expect(found[0]?.locator).toContain('encode');
    expect(found[0]?.message).toMatch(/\d+/);
  });
});

describe('the gate result is the doc Data Model', () => {
  it('passes a clean submission, marks it publishable and hands back its index', async () => {
    const made = await fixture();

    const result = runSubmissionGate({
      prId: 'pr-7',
      corpora: [made.submission()],
      upstream: [await coverage(made)],
      measure: await specMeter(),
    });

    expect(result.prId).toBe('pr-7');
    expect(failed(result.checks)).toEqual([]);
    expect(result.pass).toBe(true);
    expect(result.publishable).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.index?.entries.map((entry) => entry.corpusEntryId).sort()).toEqual([
      'TOY_0_RANGEERROR',
      'TOY_1_TYPEERROR',
    ]);
  });

  it('keys every declared check, every run', async () => {
    const made = await fixture();

    const result = runSubmissionGate({ prId: 'pr-8', corpora: [made.submission()] });

    expect(Object.keys(result.checks).sort()).toEqual([...GATE_CHECKS].sort());
  });

  it('never reports a check it could not run as passed', async () => {
    const made = await fixture();

    const result = runSubmissionGate({ prId: 'pr-9', corpora: [made.submission()] });

    expect(result.checks.registryTruth).toBe('not-run');
    expect(result.checks.folklore).toBe('not-run');
    expect(result.checks.budget).toBe('not-run');
    expect(result.pass).toBe(false);
    expect(result.publishable).toBe(false);
    expect(result.violations.join('\n')).toContain('verifyAgainstUpstream');
  });

  it('renders every finding as a string a PR comment can carry', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      topics: corpus.topics.map((topic) => ({ ...topic, examples: [] })),
    }));

    const result = runSubmissionGate({ prId: 'pr-10', corpora: [made.submission()] });

    expect(result.violations.length).toBe(result.findings.length);
    expect(result.violations.every((line) => typeof line === 'string' && line.length > 0)).toBe(
      true,
    );
    expect(result.violations.join('\n')).toContain('loopLint');
    expect(result.violations.join('\n')).toContain('toy-encoder');
  });
});
