// Owner Endorsement [30]: the REAL target package whose LIVE manifest carries
// the owner's declaration, and the REAL gate ruling endorsement is read on top
// of.
//
// Nothing here types a manifest the gate then reads back out of memory. The
// `comprehendo` block is written into the target package's own `package.json`
// BEFORE `npm pack`, so it travels inside the tarball and arrives in the
// install root exactly the way a published release's manifest does. That is
// the whole premise of this tier: the manifest is the one channel only a real
// publish credential can write, so a fixture that skipped the publish path
// would be testing something else.
//
// Everything else is Submission Gate [29]'s own fixture: a real five-file
// corpus authored by Corpus Generator [17], parsed by Corpus Format [28],
// installed by a real `npm pack` plus `npm install --offline`, and verified
// against that installed package by 29's real `verifyAgainstUpstream`.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { BudgetMeter, BudgetRecord, BudgetScope } from '../../src/gate-budget.js';
import { runSubmissionGate } from '../../src/gate.js';
import type { GateResult } from '../../src/gate.js';
import { verifyAgainstUpstream } from '../../src/gate-upstream.js';
import type { UpstreamVerification } from '../../src/gate-upstream.js';
import { readJsonFile, writeJsonFile } from './authored-corpus.js';
import {
  EMPTY_INPUT_WITNESS,
  NO_PREFIX_WITNESS,
  fixture,
  installTarget,
} from './gate-fixture.js';
import type { Fixture } from './gate-fixture.js';

/** The CC5 budget harness itself, so a green gate here is a really-measured one. */
let meter: Promise<BudgetMeter> | undefined;

export async function specMeter(): Promise<BudgetMeter> {
  meter ??= (async (): Promise<BudgetMeter> => {
    const module = (await import(
      /* @vite-ignore */ pathToFileURL(
        join(import.meta.dirname, '..', '..', '..', 'spec', 'kit', 'budget', 'measure.js'),
      ).href
    )) as { measureScope: (scope: string, payload: unknown) => BudgetRecord };
    return (scope: BudgetScope, payload: unknown): BudgetRecord =>
      module.measureScope(scope, payload);
  })();
  return meter;
}

/**
 * Write the owner's `comprehendo` block into the TARGET package's manifest,
 * before it is packed. This is the publish credential the tier rests on,
 * modelled the only honest way: the block ships inside the release.
 */
export function declareInTargetManifest(made: Fixture, block: unknown): void {
  const path = join(made.target, 'package.json');
  writeJsonFile(path, { ...readJsonFile(path), comprehendo: block });
}

export interface Submitted {
  readonly made: Fixture;
  /** The install root CI handed the gate, with the target really unpacked in it. */
  readonly installRoot: string;
  readonly gate: GateResult;
  readonly upstream: UpstreamVerification;
}

export interface SubmitOptions {
  /** Omit the upstream verification, so `registryTruth` reads `not-run`. */
  readonly skipUpstream?: boolean;
}

/**
 * A real corpus PR, ruled on by the real gate. With `skipUpstream`, CI never
 * ran `verifyAgainstUpstream`, which is the state 29 says can never be `pass`.
 */
export async function submit(
  made: Fixture,
  options: SubmitOptions = {},
): Promise<Submitted> {
  const installRoot = installTarget(made);
  const upstream = await verifyAgainstUpstream({
    corpus: made.source(),
    directory: made.name,
    installRoot,
    witnesses: [EMPTY_INPUT_WITNESS, NO_PREFIX_WITNESS],
  });
  const gate = runSubmissionGate({
    prId: `pr-${made.name}`,
    corpora: [made.submission()],
    ...(options.skipUpstream === true ? {} : { upstream: [upstream] }),
    measure: await specMeter(),
  });
  return { made, installRoot, gate, upstream };
}

/** A target package with an owner declaration, submitted and ruled on. */
export async function submittedWith(
  block: unknown,
  options: SubmitOptions = {},
): Promise<Submitted> {
  const made = await fixture();
  if (block !== undefined) declareInTargetManifest(made, block);
  return submit(made, options);
}
