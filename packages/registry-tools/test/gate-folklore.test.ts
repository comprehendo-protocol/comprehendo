// CC4 Folklore Gate [26], enforced by Submission Gate [29].
//
// Every twin code and every fix ships only if a real test really induced it.
// The coverage these tests diff against is NOT an author's declaration: it is
// what `verifyAgainstUpstream` OBSERVED while calling the really-installed
// package, so an entry is provoked here in exactly 26's sense (an actual run
// actually triggered the failure and actually observed the twin and the fix)
// or it is named and rejected.

import { afterEach, describe, expect, it } from 'vitest';

import { folkloreFindings } from '../src/gate-folklore.js';
import { verifyAgainstUpstream } from '../src/gate-upstream.js';
import type { InductionWitness, UpstreamVerification } from '../src/gate-upstream.js';
import { runSubmissionGate } from '../src/gate.js';
import {
  EMPTY_INPUT,
  EMPTY_INPUT_WITNESS,
  NO_PREFIX,
  NO_PREFIX_WITNESS,
  cleanAll,
  driftTarget,
  fixture,
  installTarget,
} from './helpers/gate-fixture.js';
import type { Fixture } from './helpers/gate-fixture.js';

afterEach(cleanAll);

const coverage = async (
  made: Fixture,
  witnesses: readonly InductionWitness[],
): Promise<UpstreamVerification> =>
  verifyAgainstUpstream({
    corpus: made.source(),
    directory: made.name,
    installRoot: installTarget(made),
    witnesses,
  });

const messages = (made: Fixture, verification: UpstreamVerification): string =>
  folkloreFindings(made.submission(), verification)
    .map((found) => found.message)
    .join('\n');

describe('the folklore rule rejects what no test provoked', () => {
  it('accepts every entry the gate really induced', async () => {
    const made = await fixture();

    const found = folkloreFindings(
      made.submission(),
      await coverage(made, [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS]),
    );

    expect(found).toEqual([]);
  });

  it('rejects an unprovoked twin code BY NAME', async () => {
    const made = await fixture();

    const said = messages(made, await coverage(made, [EMPTY_INPUT_WITNESS]));

    expect(said).toContain(NO_PREFIX);
    expect(said).not.toContain(EMPTY_INPUT);
    expect(said.toLowerCase()).toContain('folklore');
  });

  it('rejects an unprovoked fix BY NAME, not merely its twin', async () => {
    const made = await fixture();

    const said = messages(made, await coverage(made, [EMPTY_INPUT_WITNESS]));

    expect(said).toContain('Call decode with a value it accepts');
  });

  it('rejects a fix whose apply was never proved to resolve the failure', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      fixes: Object.fromEntries(
        Object.entries(corpus.fixes).map(([id, list]) => [
          id,
          list.map((fix) => (id.includes('#encode#') ? { ...fix, apply: { encode: [''] } } : fix)),
        ]),
      ),
    }));

    const said = messages(made, await coverage(made, [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS]));

    expect(said).toContain('Call encode with a value it accepts');
  });

  it('counts a docs-pointer fix as provoked exactly when its twin was induced', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      fixes: Object.fromEntries(
        Object.entries(corpus.fixes).map(([id, list]) => [
          id,
          list.map((fix) => {
            const pointerOnly = { ...fix };
            delete pointerOnly['apply'];
            return pointerOnly;
          }),
        ]),
      ),
    }));

    const both = folkloreFindings(
      made.submission(),
      await coverage(made, [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS]),
    );
    const one = messages(made, await coverage(made, [EMPTY_INPUT_WITNESS]));

    expect(both).toEqual([]);
    expect(one).toContain('Call decode with a value it accepts');
  });

  it('fails a fix that STOPPED reproducing as drift, never as a silent pass', async () => {
    const made = await fixture();
    driftTarget(made);

    const found = folkloreFindings(
      made.submission(),
      await coverage(made, [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS]),
    );
    const about = found.filter((entry) => entry.message.includes(EMPTY_INPUT));

    expect(about.length).toBe(1);
    expect(about[0]?.message.toLowerCase()).toContain('drift');
    expect(about[0]?.message.toLowerCase()).not.toContain('no inducing test');
  });
});

describe('one discipline for both tiers', () => {
  it('runs the identical checks on a native corpus and a community submission', async () => {
    const native = await fixture('toy-encoder');
    const community = await fixture('toy-tagger');
    const witnesses = [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS];

    const result = runSubmissionGate({
      prId: 'pr-1',
      corpora: [native.submission(), community.submission()],
      upstream: [await coverage(native, witnesses), await coverage(community, witnesses)],
    });

    // No tier flag exists to special-case on: the two corpora are the same
    // kind of input, so a defect in either is reported the same way.
    expect(result.findings.filter((found) => found.corpus === 'toy-encoder').length).toBe(
      result.findings.filter((found) => found.corpus === 'toy-tagger').length,
    );
  });

  it('reports the same defect the same way whichever tier carries it', async () => {
    const native = await fixture('toy-encoder');
    const community = await fixture('toy-tagger');
    const all = [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS];
    const short = [EMPTY_INPUT_WITNESS];

    const nativeDefect = runSubmissionGate({
      prId: 'pr-1',
      corpora: [native.submission(), community.submission()],
      upstream: [await coverage(native, short), await coverage(community, all)],
    });
    const communityDefect = runSubmissionGate({
      prId: 'pr-1',
      corpora: [native.submission(), community.submission()],
      upstream: [await coverage(native, all), await coverage(community, short)],
    });

    expect(nativeDefect.checks).toEqual(communityDefect.checks);
    expect(nativeDefect.findings.map((found) => found.check).sort()).toEqual(
      communityDefect.findings.map((found) => found.check).sort(),
    );
  });
});
