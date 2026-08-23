// Owner Endorsement [30] feeding Config Loader [23]'s `require` knob, end to
// end, through core's REAL router.
//
// 23 shipped the ladder, the `InstalledCorpus.trust` slot and the refusal, and
// recorded in its Known Issues that no trust DATA exists until this feature.
// This file is that slot being filled for real: a real corpus is submitted, a
// real gate rules on it, a real live manifest pins its content, this component
// computes a status, and THAT value is what the consumer's `require` knob is
// answered against. Nothing in the loop is a double.
//
// Core cannot be imported statically from this package (they install
// independently and `rootDir` rejects the cross-package path), so core's real
// modules are loaded at run time by file URL, exactly the way core's own
// suites load THIS package's fingerprint matcher.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { pack } from '../src/corpus-format.js';
import { corpusDigest } from '../src/endorsement-digest.js';
import { readTargetManifest } from '../src/endorsement-manifest.js';
import { TRUST_LADDER, computeEndorsement } from '../src/endorsement.js';
import type { TrustStatus } from '../src/endorsement.js';
import { buildFingerprintIndex } from '../src/fingerprint.js';
import { fingerprintsOf } from '../src/gate-fingerprint.js';
import { EMPTY_INPUT, cleanAll, fixture } from './helpers/gate-fixture.js';
import { declareInTargetManifest, submit } from './helpers/endorsement-fixture.js';
import type { Submitted } from './helpers/endorsement-fixture.js';

afterEach(cleanAll);

const CORE_SRC = join(import.meta.dirname, '..', '..', 'core', 'src');

/** Core's real module, by file URL. Loosely typed: these suites only drive it. */
const coreModule = async <T>(file: string): Promise<T> =>
  (await import(/* @vite-ignore */ pathToFileURL(join(CORE_SRC, file)).href)) as T;

interface Decision {
  readonly source: string;
  readonly reason: string;
  readonly knob?: string;
}

interface RouterLike {
  comprehend(raw: unknown): { readonly code: string };
  decideFor(pkg: string, raw?: unknown): Decision;
}

interface RouterModule {
  readonly createRouter: (environment: unknown, config: unknown) => RouterLike;
}

interface TwinModule {
  readonly UNSTRUCTURED_CODE: string;
}

interface ConsumerModule {
  readonly TRUST_LEVELS: readonly string[];
}

/** The real failure, thrown by the really-installed package, caught as an agent would. */
async function realThrow(submitted: Submitted): Promise<unknown> {
  const entry = join(submitted.installRoot, 'node_modules', submitted.made.name, 'index.js');
  const module = (await import(/* @vite-ignore */ pathToFileURL(entry).href)) as {
    encode: (input: string) => string;
  };
  try {
    module.encode('');
  } catch (error) {
    return error;
  }
  throw new Error('the installed package did not throw, so there is nothing to route');
}

/** A router over the submitted corpus, at whatever rung the endorsement gave it. */
async function routerOver(submitted: Submitted, trust: TrustStatus, config: unknown): Promise<RouterLike> {
  const { createRouter } = await coreModule<RouterModule>('router.ts');
  const source = submitted.made.source();
  return createRouter(
    {
      matcher: buildFingerprintIndex(fingerprintsOf(source)),
      corpora: [
        {
          package: source.package,
          corpusPackage: `@comprehendo/${source.package}`,
          catalog: pack(source).twins,
          version: source.version,
          trust,
        },
      ],
    },
    config,
  );
}

/** A submission the owner pinned to its own content, so it really is ENDORSED. */
async function endorsed(): Promise<Submitted> {
  const made = await fixture();
  declareInTargetManifest(made, { corpus: corpusDigest(made.source()).digest });
  return submit(made);
}

describe('the ladder this component writes is the ladder core reads', () => {
  it('spells the three rungs exactly as Config Loader [23] spells them', async () => {
    const { TRUST_LEVELS } = await coreModule<ConsumerModule>('config-consumer.ts');

    expect([...TRUST_LADDER]).toEqual([...TRUST_LEVELS]);
  });
});

describe('a corpus this component endorses satisfies require: endorsed', () => {
  it('routes to the sidecar corpus for a consumer demanding an endorsed one', async () => {
    const submitted = await endorsed();
    const record = computeEndorsement({
      gate: submitted.gate,
      directory: submitted.made.name,
      corpus: submitted.made.source(),
      manifest: readTargetManifest(submitted.installRoot, submitted.made.name),
    });
    const pkg = submitted.made.source().package;

    const router = await routerOver(submitted, record.status, { require: { [pkg]: 'endorsed' } });
    const decision = router.decideFor(pkg);

    expect(record.status).toBe('endorsed');
    expect(decision.source).toBe('sidecar');
    expect(decision.knob).toBe('require');
  });

  it('answers a real thrown error with the corpus twin, demand and all', async () => {
    const submitted = await endorsed();
    const record = computeEndorsement({
      gate: submitted.gate,
      directory: submitted.made.name,
      corpus: submitted.made.source(),
      manifest: readTargetManifest(submitted.installRoot, submitted.made.name),
    });
    const pkg = submitted.made.source().package;

    const router = await routerOver(submitted, record.status, { require: { [pkg]: 'endorsed' } });

    expect(router.comprehend(await realThrow(submitted)).code).toBe(EMPTY_INPUT);
  });
});

describe('a corpus this component leaves at community does not', () => {
  it('routes nowhere for a consumer demanding an endorsed corpus', async () => {
    const made = await fixture();
    const submitted = await submit(made);
    const record = computeEndorsement({
      gate: submitted.gate,
      directory: made.name,
      corpus: made.source(),
      manifest: readTargetManifest(submitted.installRoot, made.name),
    });
    const pkg = made.source().package;

    const router = await routerOver(submitted, record.status, { require: { [pkg]: 'endorsed' } });
    const decision = router.decideFor(pkg);

    expect(record.status).toBe('community');
    expect(decision.source).toBe('none');
    expect(decision.reason).toContain('endorsed');
  });

  it('answers the honest UNSTRUCTURED rather than the corpus that was ruled out', async () => {
    const made = await fixture();
    const submitted = await submit(made);
    const pkg = made.source().package;
    const { UNSTRUCTURED_CODE } = await coreModule<TwinModule>('twin.ts');

    const router = await routerOver(submitted, 'community', { require: { [pkg]: 'endorsed' } });

    expect(router.comprehend(await realThrow(submitted)).code).toBe(UNSTRUCTURED_CODE);
  });

  it('still answers that same corpus for a consumer who demanded nothing', async () => {
    const made = await fixture();
    const submitted = await submit(made);

    const router = await routerOver(submitted, 'community', {});

    expect(router.comprehend(await realThrow(submitted)).code).toBe(EMPTY_INPUT);
  });
});
