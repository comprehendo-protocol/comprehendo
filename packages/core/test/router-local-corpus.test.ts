/**
 * Config Loader [23], the `local` knob: a private corpus mounted for an
 * internal package, from a real directory on a real disk.
 *
 * The mechanism is deliberately the one that already exists. A local corpus is
 * a directory carrying the same artifacts an installed `@comprehendo/<pkg>`
 * package ships (`comprehendo pack`'s output plus the fingerprint and twin
 * artifacts), so Corpus Generator [17] serves a private corpus with no second
 * code path, and mounting it puts its fingerprints in the SAME index every
 * installed corpus is compiled into, so a collision between a private corpus
 * and a public one is visible as an ambiguity (CC10 [20]) instead of being
 * resolved by load order.
 *
 * Nothing here is published: the internal package is not in `node_modules`,
 * its corpus is not under the registry scope, and no network exists.
 *
 * @see .mdd/docs/23-config-loader.md
 * @see .mdd/docs/17-corpus-generator.md
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ConsumerConfig } from '../src/config.js';
import type { DocsTopic, Undocumented } from '../src/docs.js';
import { createRouter } from '../src/router.js';
import type { Environment, Router } from '../src/router.js';
import { discoverInstalledCorpora } from '../src/router-discovery.js';
import { UNSTRUCTURED_CODE } from '../src/twin.js';
import { catalog, sortEntry } from './helpers/catalog.js';
import {
  TOY,
  TOY_CODE,
  TOY_RAW,
  cleanTrees,
  corpusFormatModule,
  fingerprintModule,
  makeTree,
  toyCorpusFiles,
  toyPacked,
} from './helpers/sidecar.js';
import type { Tree } from './helpers/sidecar.js';

/** An internal package: nobody published it, and nobody ever will. */
const INTERNAL = 'our-internal-lib';

/** A failure only the internal package raises, cataloged in its private corpus. */
const INTERNAL_RAW = 'ledger sync rejected the write: 42 entries pending';

/** Where the consuming project keeps the corpus it wrote for its own package. */
const LOCAL_PATH = './comprehendo/our-internal-lib';

const localFingerprint = (messagePattern = 'ledger sync rejected the write: *'): unknown => ({
  package: INTERNAL,
  corpusEntryId: TOY_CODE,
  messagePattern,
});

/** The file a privately authored corpus carries: exactly an installed one's. */
async function localCorpusFiles(messagePattern?: string): Promise<Record<string, string>> {
  const { readPackedCorpus, serializeCorpus } = await corpusFormatModule();
  const packed = readPackedCorpus({
    comprehendo: '0.1',
    corpus_packed: 1,
    package: INTERNAL,
    provider: INTERNAL,
    version: '1.0.0',
    docs: toyPacked(),
    twins: catalog(sortEntry),
    fingerprints: [localFingerprint(messagePattern)],
  });
  return { 'comprehendo.corpus.json': serializeCorpus(packed) };
}

/** Write those files into a directory of the consuming project, not node_modules. */
function writeCorpusAt(tree: Tree, relative: string, files: Record<string, string>): string {
  const home = tree.path(...relative.replace(/^\.\//, '').split('/'));
  mkdirSync(home, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(home, name), text, 'utf8');
  return home;
}

async function environmentFor(tree: Tree, config?: ConsumerConfig): Promise<Environment> {
  const { buildFingerprintIndex } = await fingerprintModule();
  return discoverInstalledCorpora({
    root: tree.root,
    buildIndex: buildFingerprintIndex,
    docs: { sink: () => undefined },
    ...(config === undefined ? {} : { config }),
  });
}

let tree: Tree;
let router: Router;
let environment: Environment;

beforeAll(async () => {
  tree = makeTree();
  // A published corpus for the un-adopted public package, installed normally.
  tree.installCorpus(await toyCorpusFiles());
  tree.installTarget(TOY);
  // The private corpus, in the project's own tree. The internal package is not
  // installed under node_modules at all.
  writeCorpusAt(tree, LOCAL_PATH, await localCorpusFiles());
  environment = await environmentFor(tree, { local: { [INTERNAL]: LOCAL_PATH } });
  router = createRouter(environment, { local: { [INTERNAL]: LOCAL_PATH } });
});

afterAll(() => {
  cleanTrees();
});

describe('local mounts a private corpus for an internal package', () => {
  it('discovers the private corpus beside the installed public one', () => {
    expect(environment.defects).toEqual([]);
    expect(environment.corpora.map((corpus) => corpus.package).sort()).toEqual(
      [INTERNAL, TOY].sort(),
    );
  });

  it('never claims the private corpus is a published registry package', () => {
    const local = environment.corpora.find((corpus) => corpus.package === INTERNAL);

    expect(local?.corpusPackage.startsWith('@comprehendo/')).toBe(false);
    expect(local?.corpusPackage).toContain(INTERNAL);
  });

  it('answers docs for a package that was never published anywhere', () => {
    const answer = router.docs(INTERNAL, 'aggregation stages') as DocsTopic;

    expect(answer.topic).toBe('aggregation stages');
    expect(answer.summary.length).toBeGreaterThan(0);
  });

  it('twins an error from the internal package through its private corpus', () => {
    const twin = router.comprehend(new Error(INTERNAL_RAW));

    expect(twin.code).toBe(TOY_CODE);
    expect(twin.fixes.length).toBeGreaterThan(0);
  });

  it('reports the knob that put a corpus there at all', () => {
    const decision = router.decideFor(INTERNAL);

    expect(decision.source).toBe('sidecar');
    expect(decision.knob).toBe('local');
    expect(decision.reason).toContain(INTERNAL);
  });

  it('leaves the installed public corpus answering exactly as before', () => {
    expect(router.comprehend(new Error(TOY_RAW)).code).toBe(TOY_CODE);
    expect(router.decideFor(TOY).knob).toBeUndefined();
  });
});

describe('without the knob, the same project has no corpus for that package', () => {
  it('finds nothing to route with, and says so honestly', async () => {
    const unmounted = createRouter(await environmentFor(tree));

    expect(unmounted.packages).toEqual([TOY]);
    expect(unmounted.comprehend(new Error(INTERNAL_RAW)).code).toBe(UNSTRUCTURED_CODE);
    expect((unmounted.docs(INTERNAL, 'aggregation stages') as Undocumented).code).toBe(
      'UNDOCUMENTED',
    );
  });
});

describe('a local path is resolved, and its failures are reported', () => {
  it('resolves a relative path against the consuming project root', async () => {
    const found = await environmentFor(tree, { local: { [INTERNAL]: LOCAL_PATH } });

    expect(found.corpora.map((corpus) => corpus.package)).toContain(INTERNAL);
  });

  it('accepts an absolute path just as well', async () => {
    const absolute = tree.path('comprehendo', 'our-internal-lib');
    const found = await environmentFor(tree, { local: { [INTERNAL]: absolute } });

    expect(found.corpora.map((corpus) => corpus.package)).toContain(INTERNAL);
  });

  it('reports a local path with no corpus at it, never a silent skip', async () => {
    const found = await environmentFor(tree, { local: { 'ghost-lib': './corpora/ghost' } });

    expect(found.corpora.map((corpus) => corpus.package)).not.toContain('ghost-lib');
    expect(found.defects).toHaveLength(1);
    expect(found.defects?.[0]?.at).toContain('ghost-lib');
    expect(found.defects?.[0]?.detail.length).toBeGreaterThan(0);
  });
});

describe('a private corpus joins the one index, so collisions stay visible', () => {
  /** A project whose private corpus claims a failure text the public one also claims. */
  const overlapping = async (messagePattern: string): Promise<Tree> => {
    const rival = makeTree();
    rival.installCorpus(await toyCorpusFiles());
    rival.installTarget(TOY);
    writeCorpusAt(rival, LOCAL_PATH, await localCorpusFiles(messagePattern));
    return rival;
  };

  it('reports a text two corpora both match as ambiguous, never a guess (CC10)', async () => {
    // A different fingerprint that happens to cover the same raw text. The
    // matcher cannot pick, and a private corpus must not win by being loaded
    // last: the answer is UNSTRUCTURED with both candidates named.
    const rival = await overlapping('* memory limit of * bytes');

    const found = await environmentFor(rival, { local: { [INTERNAL]: LOCAL_PATH } });
    const match = found.matcher.match(TOY_RAW);

    expect(match.outcome).toBe('ambiguous');
    expect(match.candidates.map((candidate) => candidate.package).sort()).toEqual(
      [INTERNAL, TOY].sort(),
    );
    expect(createRouter(found).comprehend(new Error(TOY_RAW)).code).toBe(UNSTRUCTURED_CODE);
  });

  it('refuses to build at all when the two declare the identical fingerprint', async () => {
    // 21's index never picks a winner between identical fingerprints, and 22
    // deliberately does not catch that refusal. Mounting a private corpus is
    // not an exemption: a corpus nobody published still cannot quietly claim
    // a public corpus's failure.
    const rival = await overlapping('Sort exceeded memory limit of * bytes');

    await expect(environmentFor(rival, { local: { [INTERNAL]: LOCAL_PATH } })).rejects.toThrow(
      /collision/i,
    );
  });
});
