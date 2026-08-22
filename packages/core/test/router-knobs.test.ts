/**
 * Config Loader [23], the routing half: each of the five knobs changing what
 * the router actually does, in isolation.
 *
 * The bar the wave sets is "demonstrably changes routing, none is
 * theoretical", so every knob here is asserted twice: once on the pure
 * decision (`decideRoute`, which names the knob that decided) and once on the
 * surface an agent calls (`comprehend`/`docs` answering differently with the
 * knob set than without it). `local` is the one knob whose demonstration needs
 * a real disk, and it lives in `router-local-corpus.test.ts`.
 *
 * @see .mdd/docs/23-config-loader.md
 * @see .mdd/docs/22-router-precedence.md
 */
import { describe, expect, it } from 'vitest';

import { readPackageJson } from '../src/config.js';
import type { DocsTopic, LookupRecord, Undocumented } from '../src/docs.js';
import { createRouter, decideRoute } from '../src/router.js';
import type { CorpusEvidence, InstalledCorpus, Router, RouterConfig } from '../src/router.js';
import { UNSTRUCTURED_CODE } from '../src/twin.js';
import {
  TOY,
  TOY_CODE,
  TOY_CORPUS_PACKAGE,
  TOY_RAW,
  nativeEntry,
  toyEnvironment,
  toyInstalled,
} from './helpers/sidecar.js';

/** The installed toy corpus, with the version and trust an install would carry. */
const installed = (extra: Partial<InstalledCorpus> = {}, lookups: LookupRecord[] = []): InstalledCorpus => ({
  ...toyInstalled(lookups),
  version: '0.3.1',
  ...extra,
});

/** A router over exactly that corpus, configured with the consumer's knobs. */
const routerWith = async (config: RouterConfig, corpus: InstalledCorpus = installed()): Promise<Router> =>
  createRouter(await toyEnvironment({ corpora: [corpus] }), config);

/** What the environment knows about the installed corpus, as decideRoute takes it. */
const corpusEvidence = (extra: Partial<CorpusEvidence> = {}): CorpusEvidence => ({
  installed: true,
  corpusPackage: TOY_CORPUS_PACKAGE,
  version: '0.3.1',
  ...extra,
});

const code = (raw: unknown, router: Router): string => router.comprehend(raw).code;

describe('the baseline every knob is measured against', () => {
  it('answers from the installed sidecar corpus with no configuration at all', async () => {
    const router = await routerWith({});

    expect(router.decideFor(TOY).source).toBe('sidecar');
    expect(router.decideFor(TOY).knob).toBeUndefined();
    expect(code(TOY_RAW, router)).toBe(TOY_CODE);
    expect((router.docs(TOY, 'aggregation stages') as DocsTopic).topic).toBe('aggregation stages');
  });
});

describe('prefer: reverses native-vs-sidecar precedence, per package', () => {
  it('routes to the sidecar for a natively adopted package', () => {
    const decision = decideRoute(TOY, { marker: nativeEntry() }, { prefer: { [TOY]: 'sidecar' } });

    expect(decision.source).toBe('sidecar');
    expect(decision.knob).toBe('prefer');
    expect(decision.reason).toContain('reverses native precedence');
  });

  it('changes which twin comprehend returns for a natively adopted package', async () => {
    const environment = await toyEnvironment({
      corpora: [installed()],
      native: { [TOY]: { marker: nativeEntry() } },
    });
    const deferring = createRouter(environment);
    const preferring = createRouter(environment, { prefer: { [TOY]: 'sidecar' } });

    // Native present: the router defers, and a value carrying no twin of its
    // own comes back UNSTRUCTURED rather than as the sidecar's twin.
    expect(code(TOY_RAW, deferring)).toBe(UNSTRUCTURED_CODE);
    expect(code(TOY_RAW, preferring)).toBe(TOY_CODE);
  });

  it('leaves every other package on the default precedence', () => {
    const config = { prefer: { 'some-other-package': 'sidecar' } };

    expect(decideRoute(TOY, { marker: nativeEntry() }, config).source).toBe('native');
  });
});

describe('disable: turns Comprehendo routing off for one package entirely', () => {
  it('reports that no tier answers, and which knob said so', () => {
    const decision = decideRoute(TOY, {}, { disable: [TOY] }, corpusEvidence());

    expect(decision.source).toBe('none');
    expect(decision.knob).toBe('disable');
    expect(decision.reason).toContain(TOY);
  });

  it('outranks a native implementation and the prefer knob alike', () => {
    const config = { disable: [TOY], prefer: { [TOY]: 'sidecar' } };

    expect(decideRoute(TOY, { marker: nativeEntry() }, config).source).toBe('none');
  });

  it('makes comprehend answer UNSTRUCTURED where the corpus has a twin', async () => {
    const router = await routerWith({ disable: [TOY] });

    expect(code(TOY_RAW, router)).toBe(UNSTRUCTURED_CODE);
    expect(code(TOY_RAW, await routerWith({}))).toBe(TOY_CODE);
  });

  it('makes docs answer UNDOCUMENTED where the corpus has the topic', async () => {
    const router = await routerWith({ disable: [TOY] });
    const answer = router.docs(TOY, 'aggregation stages') as Undocumented;

    expect(answer.code).toBe('UNDOCUMENTED');
    expect(answer.source_permitted).toBe(true);
    expect(router.docs(TOY)).toEqual({ topics: [] });
  });

  it('disabling another package leaves this one routing', async () => {
    const router = await routerWith({ disable: ['some-noisy-pkg'] });

    expect(router.decideFor(TOY).source).toBe('sidecar');
    expect(code(TOY_RAW, router)).toBe(TOY_CODE);
  });
});

describe('pin: locks a package to one corpus version', () => {
  it('routes when the installed corpus is the pinned version', () => {
    const config = { pin: { [TOY_CORPUS_PACKAGE]: '0.3.1' } };
    const decision = decideRoute(TOY, {}, config, corpusEvidence());

    expect(decision.source).toBe('sidecar');
    expect(decision.knob).toBe('pin');
    expect(decision.reason).toContain('0.3.1');
  });

  it('refuses to route when the installed corpus is a different version', () => {
    const config = { pin: { [TOY_CORPUS_PACKAGE]: '1.4.2' } };
    const decision = decideRoute(TOY, {}, config, corpusEvidence());

    expect(decision.source).toBe('none');
    expect(decision.knob).toBe('pin');
    expect(decision.reason).toContain('1.4.2');
    expect(decision.reason).toContain('0.3.1');
  });

  it('accepts the pin keyed by the target package name too', () => {
    expect(decideRoute(TOY, {}, { pin: { [TOY]: '0.3.1' } }, corpusEvidence()).source).toBe(
      'sidecar',
    );
    expect(decideRoute(TOY, {}, { pin: { [TOY]: '9.9.9' } }, corpusEvidence()).source).toBe('none');
  });

  it('refuses when the installed corpus reports no version to compare', () => {
    const config = { pin: { [TOY_CORPUS_PACKAGE]: '0.3.1' } };
    const unversioned: CorpusEvidence = { installed: true, corpusPackage: TOY_CORPUS_PACKAGE };
    const decision = decideRoute(TOY, {}, config, unversioned);

    expect(decision.source).toBe('none');
    expect(decision.knob).toBe('pin');
  });

  it('changes what comprehend returns when the pin is not satisfied', async () => {
    const pinned = await routerWith({ pin: { [TOY_CORPUS_PACKAGE]: '1.4.2' } });
    const matching = await routerWith({ pin: { [TOY_CORPUS_PACKAGE]: '0.3.1' } });

    expect(code(TOY_RAW, pinned)).toBe(UNSTRUCTURED_CODE);
    expect(code(TOY_RAW, matching)).toBe(TOY_CODE);
  });

  it('pins the corpus, not the native tier: a native package is unaffected', () => {
    const config = { pin: { [TOY_CORPUS_PACKAGE]: '1.4.2' } };

    expect(decideRoute(TOY, { marker: nativeEntry() }, config, corpusEvidence()).source).toBe(
      'native',
    );
  });
});

describe('require: demands a trust level for a package corpus', () => {
  it('is satisfied by the community tier when community is what was asked for', () => {
    const decision = decideRoute(TOY, {}, { require: { [TOY]: 'community' } }, corpusEvidence());

    expect(decision.source).toBe('sidecar');
    expect(decision.knob).toBe('require');
  });

  it('refuses an unendorsed corpus when endorsed was demanded, naming both levels', () => {
    const decision = decideRoute(TOY, {}, { require: { [TOY]: 'endorsed' } }, corpusEvidence());

    expect(decision.source).toBe('none');
    expect(decision.knob).toBe('require');
    expect(decision.reason).toContain('endorsed');
    expect(decision.reason).toContain('community');
  });

  it('is satisfied by a corpus that declares the endorsed rung', () => {
    // Nothing populates this today: Owner Endorsement [30] (Wave 5) is what
    // fills `trust`. The rung is wired, so [30] adds data, not logic.
    const decision = decideRoute(
      TOY,
      {},
      { require: { [TOY]: 'endorsed' } },
      corpusEvidence({ trust: 'endorsed' }),
    );

    expect(decision.source).toBe('sidecar');
  });

  it('treats native as the top rung: a native implementation satisfies any demand', () => {
    for (const level of ['community', 'endorsed', 'native'] as const) {
      const decision = decideRoute(TOY, { marker: nativeEntry() }, { require: { [TOY]: level } });

      expect(decision.source).toBe('native');
    }
  });

  it('refuses the sidecar when native was demanded and none is present', () => {
    const decision = decideRoute(TOY, {}, { require: { [TOY]: 'native' } }, corpusEvidence());

    expect(decision.source).toBe('none');
    expect(decision.reason).toContain('native');
  });

  it('refuses a demand that is not a trust level at all, rather than ignoring it', () => {
    const decision = decideRoute(TOY, {}, { require: { [TOY]: 'trustworthy' } }, corpusEvidence());

    expect(decision.source).toBe('none');
    expect(decision.knob).toBe('require');
    expect(decision.reason).toContain('trustworthy');
  });

  it('changes what comprehend returns for an unmet demand', async () => {
    const demanding = await routerWith({ require: { [TOY]: 'endorsed' } });
    const met = await routerWith({ require: { [TOY]: 'endorsed' } }, installed({ trust: 'endorsed' }));

    expect(code(TOY_RAW, demanding)).toBe(UNSTRUCTURED_CODE);
    expect(code(TOY_RAW, met)).toBe(TOY_CODE);
  });
});

describe('the knobs compose in a stated order', () => {
  it('checks disable, then the demanded trust, then the pin', () => {
    const all: RouterConfig = {
      disable: [TOY],
      require: { [TOY]: 'endorsed' },
      pin: { [TOY_CORPUS_PACKAGE]: '9.9.9' },
    };

    expect(decideRoute(TOY, {}, all, corpusEvidence()).knob).toBe('disable');
    expect(decideRoute(TOY, {}, { ...all, disable: [] }, corpusEvidence()).knob).toBe('require');
    expect(
      decideRoute(TOY, {}, { ...all, disable: [], require: {} }, corpusEvidence()).knob,
    ).toBe('pin');
  });

  it('leaves an unconfigured package on the default precedence, whatever else is set', () => {
    const all: RouterConfig = {
      disable: ['a'],
      require: { b: 'native' },
      pin: { c: '1.0.0' },
      prefer: { d: 'sidecar' },
      local: { e: './corpora/e' },
    };
    const decision = decideRoute(TOY, {}, all, corpusEvidence());

    expect(decision.source).toBe('sidecar');
    expect(decision.knob).toBeUndefined();
  });
});

describe('CC8: no provider-side manifest field can express any of the five knobs', () => {
  it('changes nothing when a provider writes all five into its own manifest', () => {
    // The identical knobs, in the one place a provider gets to write anything.
    const hostile = JSON.stringify({
      name: TOY,
      comprehendo: {
        version: '0.1',
        level: 1,
        disable: [TOY],
        prefer: { [TOY]: 'native' },
        pin: { [TOY_CORPUS_PACKAGE]: '9.9.9' },
        require: { [TOY]: 'native' },
        local: { [TOY]: './somewhere-of-mine' },
      },
    });
    const manifest = readPackageJson(hostile);

    const decision = decideRoute(TOY, { manifest }, {}, corpusEvidence());

    // Native, because it declared a version and a level, and for no other
    // reason. No knob applied, and the consumer's own knobs still rule.
    expect(decision.source).toBe('native');
    expect(decision.knob).toBeUndefined();
    expect(decideRoute(TOY, { manifest }, { disable: [TOY] }, corpusEvidence()).source).toBe('none');
  });

  it('carries no knob-shaped field into the decision discovery view', () => {
    const manifest = readPackageJson(
      JSON.stringify({ comprehendo: { version: '0.1', level: 1, disable: ['everything'] } }),
    );

    expect(Object.keys(decideRoute(TOY, { manifest }).discovery ?? {}).sort()).toEqual([
      'comprehendo',
      'level',
      'source',
    ]);
  });
});
