// Owner Endorsement [30]: the ruling itself, read on top of Submission Gate
// [29]'s pass result and the TARGET package's LIVE manifest.
//
// Nothing here is typed by hand. The corpus is a real five-file tree Corpus
// Generator [17] wrote and Corpus Format [28] parsed; the target package is
// really packed and really installed; the owner's `comprehendo` block travels
// inside that tarball, so the manifest read is a read of a real published
// manifest; and the gate result is a real `runSubmissionGate` run with [29]'s
// real `verifyAgainstUpstream` and the spec kit's real CC5 meter behind it.
//
// THE CONTRACT THIS FILE SETTLES. [29] declares `verifyAgainstUpstream`
// mandatory before a corpus PR is marked publishable. This component never
// calls it: it reads a gate result that already carries its outcome, and it
// refuses every rung above `community` unless that outcome really is `pass`.
// The test named "refuses ... when verifyAgainstUpstream never ran" is that
// contract, satisfied transitively and proved, not asserted.

import { afterEach, describe, expect, it } from 'vitest';

import { corpusDigest } from '../src/endorsement-digest.js';
import { readTargetManifest, snapshotOf } from '../src/endorsement-manifest.js';
import { computeEndorsement } from '../src/endorsement.js';
import type { EndorsementInput } from '../src/endorsement.js';
import type { GateResult } from '../src/gate.js';
import { cleanAll, fixture } from './helpers/gate-fixture.js';
import { declareInTargetManifest, submit, submittedWith } from './helpers/endorsement-fixture.js';
import type { Submitted } from './helpers/endorsement-fixture.js';

afterEach(cleanAll);

/** The endorsement question, asked of a real submission and a real manifest. */
const askedOf = (submitted: Submitted, approvers?: readonly string[]): EndorsementInput => ({
  gate: submitted.gate,
  directory: submitted.made.name,
  corpus: submitted.made.source(),
  manifest: readTargetManifest(submitted.installRoot, submitted.made.name),
  ...(approvers === undefined ? {} : { approvers }),
});

/** A submission whose live manifest pins the exact content that was submitted. */
async function pinnedToItsOwnContent(): Promise<Submitted> {
  const made = await fixture();
  const digest = corpusDigest(made.source()).digest;
  declareInTargetManifest(made, { corpus: digest });
  return submit(made);
}

describe('the sha256 pin: matching content is ENDORSED', () => {
  it('endorses a corpus release whose content is exactly what the owner pinned', async () => {
    const submitted = await pinnedToItsOwnContent();

    const record = computeEndorsement(askedOf(submitted));

    expect(submitted.gate.pass).toBe(true);
    expect(record.status).toBe('endorsed');
    expect(record.endorsedBy).toBe('sha256-match');
    expect(record.digest).toBe(corpusDigest(submitted.made.source()).digest);
  });

  it('records the package, the corpus version and the manifest it read', async () => {
    const submitted = await pinnedToItsOwnContent();

    const record = computeEndorsement(askedOf(submitted));

    expect(record.package).toBe(submitted.made.name);
    expect(record.corpusVersion).toBe(submitted.made.source().version);
    expect(record.manifestSnapshot.declaredName).toBe(submitted.made.name);
    expect(record.manifestSnapshot.corpus).toBe(record.digest);
  });

  it('withholds endorsement when the pin names content that was not submitted', async () => {
    const submitted = await submittedWith({
      corpus: 'a'.repeat(64),
    });

    const record = computeEndorsement(askedOf(submitted));

    expect(record.status).toBe('community');
    expect(record.endorsedBy).toBeUndefined();
    expect(record.reasons.join(' ')).toContain('a'.repeat(64));
  });

  it('withholds endorsement when the pin is not a sha256 at all', async () => {
    const submitted = await submittedWith({ corpus: '@comprehendo/toy-encoder' });

    const record = computeEndorsement(askedOf(submitted));

    expect(record.status).toBe('community');
    expect(record.reasons.join(' ')).toContain('sha256');
  });
});

describe('the owners delegation: a named delegate approving is owner review', () => {
  it('endorses on a declared delegate approval, with no republish', async () => {
    const submitted = await submittedWith({ owners: ['github:octocat'] });

    const record = computeEndorsement(askedOf(submitted, ['github:octocat']));

    expect(record.status).toBe('endorsed');
    expect(record.endorsedBy).toBe('owner-approval');
    expect(record.manifestSnapshot.owners).toEqual(['github:octocat']);
  });

  it('withholds endorsement when the approver is nobody the owner named', async () => {
    const submitted = await submittedWith({ owners: ['github:octocat'] });

    const record = computeEndorsement(askedOf(submitted, ['github:stranger']));

    expect(record.status).toBe('community');
    expect(record.endorsedBy).toBeUndefined();
  });

  it('prefers the pin when the manifest carries both and the content matches', async () => {
    const made = await fixture();
    declareInTargetManifest(made, {
      corpus: corpusDigest(made.source()).digest,
      owners: ['github:octocat'],
    });
    const submitted = await submit(made);

    const record = computeEndorsement(askedOf(submitted, ['github:octocat']));

    expect(record.endorsedBy).toBe('sha256-match');
  });

  it('falls back to the delegate when the pin is stale but a delegate approved', async () => {
    const submitted = await submittedWith({
      corpus: 'b'.repeat(64),
      owners: ['github:octocat'],
    });

    const record = computeEndorsement(askedOf(submitted, ['github:octocat']));

    expect(record.status).toBe('endorsed');
    expect(record.endorsedBy).toBe('owner-approval');
  });
});

describe('the top rung: a package that speaks Comprehendo itself', () => {
  it('records native when the live manifest carries the [15] declaration', async () => {
    const submitted = await submittedWith({ version: '0.1', level: 2 });

    const record = computeEndorsement(askedOf(submitted));

    expect(record.status).toBe('native');
    expect(record.endorsedBy).toBeUndefined();
    expect(record.manifestSnapshot.native).toEqual({ version: '0.1', level: 2 });
  });
});

describe('[29]s verifyAgainstUpstream is what every rung above community rests on', () => {
  it('refuses endorsement when verifyAgainstUpstream never ran', async () => {
    const made = await fixture();
    declareInTargetManifest(made, { corpus: corpusDigest(made.source()).digest });
    const submitted = await submit(made, { skipUpstream: true });

    const record = computeEndorsement(askedOf(submitted));

    expect(submitted.gate.checks.registryTruth).toBe('not-run');
    expect(submitted.gate.pass).toBe(false);
    expect(record.status).toBe('community');
    expect(record.reasons.join(' ')).toContain('registryTruth');
  });

  it('refuses endorsement on a result claiming pass while registryTruth never ran', async () => {
    const submitted = await pinnedToItsOwnContent();
    // A caller handing the endorsement step a doctored ruling. The guard is
    // read directly off the check, so `pass` alone never buys a rung.
    const doctored: GateResult = {
      ...submitted.gate,
      checks: { ...submitted.gate.checks, registryTruth: 'not-run' },
    };

    const record = computeEndorsement({ ...askedOf(submitted), gate: doctored });

    expect(doctored.pass).toBe(true);
    expect(record.status).toBe('community');
    expect(record.reasons.join(' ')).toContain('registryTruth');
  });

  it('refuses the native rung too when the gate could not verify the corpus', async () => {
    const made = await fixture();
    declareInTargetManifest(made, { version: '0.1', level: 2 });
    const submitted = await submit(made, { skipUpstream: true });

    const record = computeEndorsement(askedOf(submitted));

    expect(record.status).toBe('community');
  });
});

describe('endorsement is additive trust, never a veto', () => {
  it('leaves a mismatched corpus publishable, and merely unendorsed', async () => {
    const submitted = await submittedWith({ corpus: 'c'.repeat(64) });

    const record = computeEndorsement(askedOf(submitted));

    expect(record.status).toBe('community');
    expect(submitted.gate.pass).toBe(true);
    expect(submitted.gate.publishable).toBe(true);
    expect(submitted.gate.violations).toEqual([]);
  });

  it('leaves a corpus whose target declares nothing publishable and unendorsed', async () => {
    const made = await fixture();
    const submitted = await submit(made);

    const record = computeEndorsement(askedOf(submitted));

    expect(record.status).toBe('community');
    expect(record.manifestSnapshot.corpus).toBeUndefined();
    expect(record.manifestSnapshot.owners).toBeUndefined();
    expect(submitted.gate.publishable).toBe(true);
  });

  it('exposes no channel through which a ruling could block a publish', async () => {
    const submitted = await submittedWith({ corpus: 'd'.repeat(64) });

    const record = computeEndorsement(askedOf(submitted));

    expect(Object.keys(record).sort()).toEqual([
      'corpusVersion',
      'digest',
      'manifestSnapshot',
      'package',
      'reasons',
      'status',
    ]);
  });
});

describe('the manifest read is a read of the really-installed release', () => {
  it('reads the comprehendo block that travelled inside the published tarball', async () => {
    const submitted = await submittedWith({ owners: ['github:octocat'] });

    const snapshot = readTargetManifest(submitted.installRoot, submitted.made.name);

    expect(snapshot.owners).toEqual(['github:octocat']);
    expect(snapshot.version).toBe('1.0.0');
    expect(snapshot.problems).toEqual([]);
  });

  it('reports a package that is not installed rather than inventing a manifest', () => {
    const snapshot = readTargetManifest('/nonexistent-install-root', 'toy-encoder');

    expect(snapshot.corpus).toBeUndefined();
    expect(snapshot.problems.join(' ')).toContain('toy-encoder');
  });

  it('refuses to endorse against a manifest that declares another package', async () => {
    const submitted = await pinnedToItsOwnContent();
    const impostor = snapshotOf(submitted.made.name, {
      name: 'some-other-package',
      version: '1.0.0',
      comprehendo: { corpus: corpusDigest(submitted.made.source()).digest },
    });

    const record = computeEndorsement({ ...askedOf(submitted), manifest: impostor });

    expect(record.status).toBe('community');
    expect(record.reasons.join(' ')).toContain('some-other-package');
  });

  it('projects owners entries that are not strings out, and says so', () => {
    const snapshot = snapshotOf('toy-encoder', {
      name: 'toy-encoder',
      comprehendo: { owners: ['github:octocat', 7] },
    });

    expect(snapshot.owners).toEqual(['github:octocat']);
    expect(snapshot.problems.join(' ')).toContain('owners');
  });
});
