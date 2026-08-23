// Scoped Publisher [31]: the publish decision and the artifact it assembles.
//
// Nothing here types a GateResult by hand except where forging one IS the
// subject. The passing runs are Submission Gate [29]'s REAL `runSubmissionGate`
// over a REAL corpus that Corpus Generator [17] wrote to a real disk, verified
// against a REAL npm-installed target through 29's REAL `verifyAgainstUpstream`
// and measured by the REAL CC5 meter. The artifact is Corpus Format [28]'s REAL
// `pack`/`serializeCorpus`, and the hash is recomputed here with `node:crypto`
// rather than compared to a literal, so a hash that stops being a hash of the
// bytes goes red.
//
// The one place a value IS typed by hand is the hijack test: a caller handing
// in a result that CLAIMS `publishable: true` while `registryTruth` never ran
// is exactly the shape CC11 [25] exists to refuse, and there is no way to
// obtain that value from the real gate, because the real gate cannot produce
// it. Forging it is the test.

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
  CORPUS_ARTIFACT,
  CORPUS_DESCRIPTOR_KEY,
  corpusDescriptor,
  pack,
  serializeCorpus,
} from '../src/corpus-format.js';
import type { BudgetMeter, BudgetRecord, BudgetScope } from '../src/gate-budget.js';
import { runSubmissionGate } from '../src/gate.js';
import type { GateResult } from '../src/gate.js';
import { verifyAgainstUpstream } from '../src/gate-upstream.js';
import {
  PUBLISH_EVENT,
  PUBLISH_REF,
  PUBLISH_SCOPE,
  corpusPackageName,
  publishDecision,
} from '../src/publish.js';
import type { PublishDecision, PublishTrigger } from '../src/publish.js';
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

/** A real gate run that really passes: real install, real induction, real meter. */
async function passingGate(made: Fixture, prId = 'pr-31'): Promise<GateResult> {
  return runSubmissionGate({
    prId,
    corpora: [made.submission()],
    upstream: [
      await verifyAgainstUpstream({
        corpus: made.source(),
        directory: made.name,
        installRoot: installTarget(made),
        witnesses: [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS],
      }),
    ],
    measure: await specMeter(),
  });
}

/** What CI states about the merge it is publishing from. */
const MERGED: PublishTrigger = Object.freeze({
  repository: 'comprehendo-protocol/registry',
  event: PUBLISH_EVENT,
  ref: PUBLISH_REF,
  commit: '9d3f2a1c8b7e6d5f4a3b2c1d0e9f8a7b6c5d4e3f',
  mergedAt: '2026-08-22T10:00:00.000Z',
  runId: 'run-4711',
});

const reasons = (decision: PublishDecision): string[] =>
  decision.permitted ? [] : decision.refusals.map((refusal) => refusal.reason).sort();

const detail = (decision: PublishDecision): string =>
  decision.permitted ? '' : decision.refusals.map((refusal) => refusal.detail).join('\n');

describe('nothing publishes that the gate did not really pass', () => {
  it('refuses a corpus whose gate run never ran verifyAgainstUpstream', async () => {
    const made = await fixture();

    // The real gate, with no `upstream` supplied: exactly what a caller who
    // skipped the CC11 [25] verification step gets back.
    const gateResult = runSubmissionGate({ prId: 'pr-1', corpora: [made.submission()] });
    expect(gateResult.checks.registryTruth).toBe('not-run');

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(false);
    expect(reasons(decision)).toContain('unverified-against-upstream');
    expect(detail(decision)).toContain('verifyAgainstUpstream');
    expect(detail(decision)).toContain('not-run');
  });

  it('refuses a result that CLAIMS publishable while registryTruth never ran', async () => {
    const made = await fixture();
    const real = await passingGate(made);
    expect(real.publishable).toBe(true);

    // The hijack shape: `publishable` is a boolean on a plain interface, so a
    // caller can hand one in. The publish path re-reads the checks themselves
    // rather than trusting the summary flag.
    const forged: GateResult = {
      ...real,
      checks: { ...real.checks, registryTruth: 'not-run', folklore: 'not-run' },
    };

    const decision = publishDecision({
      corpus: made.source(),
      gateResult: forged,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(false);
    expect(reasons(decision)).toContain('unverified-against-upstream');
  });

  it('refuses an ordinary failing check too, naming the check', async () => {
    const made = await fixture();
    await made.rewrite((corpus) => ({
      ...corpus,
      twins: corpus.twins.map((twin) => ({ ...twin, reason: 'status: stub' })),
    }));
    const gateResult = runSubmissionGate({ prId: 'pr-2', corpora: [made.submission()] });

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(false);
    expect(reasons(decision)).toContain('gate-not-publishable');
    expect(detail(decision)).toContain('corpusFormat');
  });

  it('refuses a gate result compiled for a different corpus', async () => {
    const one = await fixture('toy-encoder');
    const two = await fixture('toy-tagger');
    const gateResult = await passingGate(one);

    const decision = publishDecision({
      corpus: two.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(false);
    expect(reasons(decision)).toContain('gate-result-not-for-this-corpus');
  });
});

describe('nothing publishes off anything but a merge to the publish branch', () => {
  it('refuses a run triggered by the pull request rather than the merge', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: { ...MERGED, event: 'pull_request' },
    });

    expect(decision.permitted).toBe(false);
    expect(reasons(decision)).toContain('not-a-merge-commit');
  });

  it('refuses a merge on any ref but the publish branch', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: { ...MERGED, ref: 'refs/heads/release-candidate' },
    });

    expect(decision.permitted).toBe(false);
    expect(reasons(decision)).toContain('not-the-publish-branch');
  });

  it('refuses a commit that is not a real commit sha, because an attestation naming one is worthless', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: { ...MERGED, commit: 'HEAD' },
    });

    expect(decision.permitted).toBe(false);
    expect(reasons(decision)).toContain('not-a-merge-commit');
  });

  it('refuses a publish with no usable version for the scoped package', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: 'latest',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(false);
    expect(reasons(decision)).toContain('no-publish-version');
  });
});

describe('a gate-passed corpus assembles a real publish record', () => {
  it('publishes as @comprehendo/<pkg> with the version CI supplies', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    expect(decision.record.package).toBe(`${PUBLISH_SCOPE}/toy-encoder`);
    expect(decision.record.version).toBe('0.1.0');
    expect(decision.record.gateResult).toBe(gateResult);
  });

  it('carries the artifact 28 really packs, as 28 really serializes it', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    expect(decision.record.artifact.filename).toBe(CORPUS_ARTIFACT);
    expect(decision.record.artifact.contents).toBe(serializeCorpus(pack(made.source())));
    expect(decision.record.descriptor).toEqual(corpusDescriptor(pack(made.source())));
  });

  it("ships a package.json declaring the corpus under 22's own key", async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    const manifest = decision.record.manifest as unknown as Record<string, unknown>;
    expect(manifest['name']).toBe(`${PUBLISH_SCOPE}/toy-encoder`);
    expect(manifest['version']).toBe('0.1.0');
    expect(Object.hasOwn(manifest, CORPUS_DESCRIPTOR_KEY)).toBe(true);
    expect(manifest[CORPUS_DESCRIPTOR_KEY]).toEqual(decision.record.descriptor);
    expect(decision.record.manifest.files).toContain(CORPUS_ARTIFACT);
  });

  it('hashes the real artifact bytes with sha256, not a placeholder', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    const expected = createHash('sha256')
      .update(serializeCorpus(pack(made.source())), 'utf8')
      .digest('hex');
    expect(decision.record.packedArtifactHash).toBe(`sha256:${expected}`);
  });

  it('hashes two different corpora differently', async () => {
    const one = await fixture('toy-encoder');
    const two = await fixture('toy-tagger');
    const decide = async (made: Fixture, prId: string): Promise<string> => {
      const decision = publishDecision({
        corpus: made.source(),
        gateResult: await passingGate(made, prId),
        version: '0.1.0',
        trigger: MERGED,
      });
      return decision.permitted ? decision.record.packedArtifactHash : 'refused';
    };

    const first = await decide(one, 'pr-a');
    const second = await decide(two, 'pr-b');

    expect(first).not.toBe('refused');
    expect(first).not.toBe(second);
  });
});

describe('every publish carries provenance tying it to the merged commit and the gate run', () => {
  it('names the repository, ref, commit and CI run the artifact came from', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made, 'pr-77');

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    const attestation = decision.record.provenanceAttestation;
    expect(attestation.repository).toBe('comprehendo-protocol/registry');
    expect(attestation.ref).toBe(PUBLISH_REF);
    expect(attestation.commit).toBe(MERGED.commit);
    expect(attestation.mergedAt).toBe(MERGED.mergedAt);
    expect(attestation.runId).toBe('run-4711');
  });

  it('carries the gate run that permitted it, by id and by check outcome', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made, 'pr-77');

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    const attested = decision.record.provenanceAttestation.gate;
    expect(attested.prId).toBe('pr-77');
    expect(attested.publishable).toBe(true);
    expect(attested.checks.registryTruth).toBe('pass');
    expect(attested.checks.folklore).toBe('pass');
  });

  it('attests the SAME bytes the record publishes, so no other artifact can ride it', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    const attestation = decision.record.provenanceAttestation;
    expect(attestation.artifact).toBe(decision.record.artifact.filename);
    expect(attestation.artifactHash).toBe(decision.record.packedArtifactHash);
    expect(attestation.package).toBe(decision.record.package);
    expect(attestation.target).toBe('toy-encoder');
  });

  it('says out loud that nothing here signed it', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    expect(decision.record.provenanceAttestation.signed).toBe(false);
  });

  it('is frozen, so a caller cannot rewrite the commit after the decision', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    expect(Object.isFrozen(decision.record.provenanceAttestation)).toBe(true);
    expect(Object.isFrozen(decision.record)).toBe(true);
  });
});

describe('the scoped name a corpus publishes under', () => {
  it('spells a plain target directly under the scope', () => {
    expect(corpusPackageName('ffmpeg')).toBe('@comprehendo/ffmpeg');
  });

  it('flattens a scoped target, because @comprehendo/@acme/widgets is not a package name', () => {
    expect(corpusPackageName('@acme/widgets')).toBe('@comprehendo/acme__widgets');
  });

  it('keeps the real target in the descriptor, which is what the router reads', async () => {
    const made = await fixture();
    const gateResult = await passingGate(made);

    const decision = publishDecision({
      corpus: made.source(),
      gateResult,
      version: '0.1.0',
      trigger: MERGED,
    });

    expect(decision.permitted).toBe(true);
    if (!decision.permitted) return;
    expect(decision.record.descriptor.target).toBe('toy-encoder');
    expect(decision.record.descriptor.artifact).toBe(CORPUS_ARTIFACT);
  });
});
