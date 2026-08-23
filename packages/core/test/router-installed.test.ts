// Router & Precedence [22], against a real installed tree.
//
// This is the suite that stops the router's precedence rules from being a
// story told to a mock. Every corpus here is a real package written to a real
// temp directory, discovered by reading real files; the fingerprint index is
// built by Fingerprint Index & Matcher [21]'s real matcher; and the "native
// toy is installed" step writes, imports and RUNS a real natively adopted
// package, catches the error it really throws, and hands it to the same
// router instance that answered from the sidecar a moment earlier.
//
// Acceptance criterion 4 ("installing the native toy flips precedence
// automatically, no router reconfiguration") is only meaningful if nothing is
// reconfigured, so the router object built in the first half is the one used
// in the second.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readManifestFile, stampManifestFile } from '../src/config.js';
import { COMPREHENDO_MARKER, probe } from '../src/marker.js';
import { createRouter } from '../src/router.js';
import type { Environment, Router } from '../src/router.js';
import { discoverInstalledCorpora } from '../src/router-discovery.js';
import type { DiscoveryOptions } from '../src/router-discovery.js';
import { UNSTRUCTURED_CODE } from '../src/twin.js';
import type { DocsIndex, DocsTopic } from '../src/docs.js';
import { catalog, sortEntry } from './helpers/catalog.js';
import {
  NATIVE_CODE,
  TOY,
  TOY_CODE,
  TOY_CORPUS_PACKAGE,
  TOY_FINGERPRINT,
  TOY_RAW,
  TOY_RAW_NOVEL,
  cleanTrees,
  corpusFormatModule,
  fingerprintModule,
  makeTree,
  nativeToySource,
  toyCorpusFiles,
  toyPacked,
} from './helpers/sidecar.js';
import type { Tree } from './helpers/sidecar.js';

/** The toy package's entry point, as the native build ships it. */
interface NativeToy {
  readonly marker: symbol;
  readonly sortByCreatedAt: () => never;
}

let tree: Tree;
let environment: Environment;
/** Built ONCE, before anything is installed natively. Never rebuilt. */
let router: Router;

const discovery = async (root: string): Promise<DiscoveryOptions> => {
  const { buildFingerprintIndex } = await fingerprintModule();
  return {
    root,
    buildIndex: buildFingerprintIndex,
    // The docs miss log is a local file for the maintainer; this suite is not
    // the maintainer, so the lookups go nowhere.
    docs: { sink: () => undefined },
  };
};

beforeAll(async () => {
  tree = makeTree();
  tree.installCorpus(await toyCorpusFiles());
  // The target package, installed and entirely un-adopted: no comprehendo key.
  tree.installTarget(TOY);
  environment = discoverInstalledCorpora(await discovery(tree.root));
  router = createRouter(environment);
});

afterAll(() => {
  cleanTrees();
});

describe('discovering installed corpora from a real node_modules tree', () => {
  it('finds a real @comprehendo/<toy> package on disk and names its target', () => {
    expect(environment.corpora).toHaveLength(1);
    expect(environment.corpora[0]).toMatchObject({
      package: TOY,
      corpusPackage: TOY_CORPUS_PACKAGE,
      version: '0.3.1',
    });
    expect(environment.defects).toEqual([]);
  });

  it('loads the compiled fingerprint artifact through the real matcher', () => {
    const match = environment.matcher.match(TOY_RAW);

    expect(match.outcome).toBe('matched');
    expect(match.outcome === 'matched' ? match.entry : undefined).toMatchObject({
      package: TOY,
      corpusEntryId: TOY_CODE,
    });
  });

  it('reports a corpus package missing its artifacts as a defect, never silently', async () => {
    const broken = makeTree();
    broken.installCorpus(
      {
        'package.json': JSON.stringify({
          name: '@comprehendo/half-installed',
          comprehendoCorpus: { target: 'half-installed' },
        }),
      },
      'half-installed',
    );

    const found = discoverInstalledCorpora(await discovery(broken.root));

    expect(found.corpora).toEqual([]);
    expect(found.defects).toEqual([
      {
        at: '@comprehendo/half-installed',
        detail: 'declares comprehendoCorpus but carries no comprehendo.corpus.json',
      },
    ]);
  });

  it('refuses an unknown corpus_packed version by name, never reads it lossily', async () => {
    // Corpus Format [28]'s ruling: the artifact declares its own format
    // version, and a reader that does not understand it must refuse loudly
    // rather than pick the fields it recognizes and ignore the rest. Proven
    // against a real corpus package built with Corpus Format [28]'s own
    // readPackedCorpus/serializeCorpus, then hand-bumped to a version this
    // build has never shipped.
    const future = makeTree();
    const { readPackedCorpus, serializeCorpus } = await corpusFormatModule();
    const packed = readPackedCorpus({
      comprehendo: '0.1',
      corpus_packed: 1,
      package: TOY,
      provider: TOY,
      version: '1.0.0',
      docs: toyPacked(),
      twins: catalog(sortEntry),
      fingerprints: [TOY_FINGERPRINT],
    }) as Record<string, unknown>;
    future.installCorpus({
      'package.json': JSON.stringify({
        name: TOY_CORPUS_PACKAGE,
        version: '0.3.1',
        comprehendoCorpus: { target: TOY, format: 7, artifact: 'comprehendo.corpus.json' },
      }),
      'comprehendo.corpus.json': serializeCorpus({ ...packed, corpus_packed: 7 }),
    });

    const found = discoverInstalledCorpora(await discovery(future.root));

    expect(found.corpora).toEqual([]);
    expect(found.defects).toEqual([
      {
        at: `${TOY_CORPUS_PACKAGE}/comprehendo.corpus.json`,
        detail: 'comprehendo.corpus.json is corpus_packed version 7; this build reads version 1',
      },
    ]);
  });

  it('reads the target package real manifest as native evidence', async () => {
    const adopted = makeTree();
    adopted.installCorpus(await toyCorpusFiles());
    adopted.installTarget(TOY, { comprehendo: { version: '0.1', level: 1 } });

    const found = discoverInstalledCorpora(await discovery(adopted.root));

    expect(found.native?.[TOY]?.manifest).toEqual({
      status: 'declared',
      declaration: { version: '0.1', level: 1 },
    });
  });

  it('reports an unreadable target manifest as a defect, never silently loses native evidence', async () => {
    // Found by review: a target package.json that EXISTS but cannot be READ
    // (here, a directory sitting where the file should be, the same failure
    // shape as EACCES/EISDIR) used to come back as undefined native evidence
    // with zero diagnostic trail, exactly the "silently skipped" outcome
    // this file's own EnvironmentDefect convention forbids everywhere else
    // (loadCorpus, artifact). A real natively-adopted package hitting a
    // transient read error must not silently lose precedence to the
    // sidecar.
    const flaky = makeTree();
    flaky.installCorpus(await toyCorpusFiles());
    mkdirSync(flaky.path('node_modules', TOY, 'package.json'), { recursive: true });

    const found = discoverInstalledCorpora(await discovery(flaky.root));

    expect(found.native?.[TOY]).toBeUndefined();
    const defects = found.defects ?? [];
    expect(defects).toHaveLength(1);
    expect(defects[0]?.at).toBe(TOY);
    expect(defects[0]?.detail).toContain(TOY);
  });

  it('ignores a non-corpus package sitting in the same scope directory', async () => {
    const mixed = makeTree();
    mixed.installCorpus(await toyCorpusFiles());
    // The registry tooling installs under the same scope and is not a corpus.
    mixed.installCorpus(
      { 'package.json': JSON.stringify({ name: '@comprehendo/registry-tools' }) },
      'registry-tools',
    );

    const found = discoverInstalledCorpora(await discovery(mixed.root));

    expect(found.corpora.map((corpus) => corpus.package)).toEqual([TOY]);
    expect(found.defects).toEqual([]);
  });
});

describe('an un-adopted toy package, end to end', () => {
  it('comprehends a real caught error into the sidecar twin', () => {
    const twin = router.comprehend(new Error(TOY_RAW));

    expect(twin.code).toBe(TOY_CODE);
    expect(twin.fixes[0]?.title).toContain('Sort on the indexed field');
    expect(router.decideFor(TOY).source).toBe('sidecar');
  });

  it('answers docs(toy, query) from the corpus packages real packed artifact', () => {
    expect((router.docs(TOY, 'capped collections') as DocsTopic).topic).toBe('capped collections');
    expect((router.docs(TOY) as DocsIndex).topics).toContain('index selection');
  });

  it('returns UNSTRUCTURED for an error the installed corpus does not cover', () => {
    const twin = router.comprehend(new Error(TOY_RAW_NOVEL));

    expect(twin.code).toBe(UNSTRUCTURED_CODE);
    expect(twin.fixes).toEqual([]);
  });
});

describe('installing the native toy flips precedence, no reconfiguration', () => {
  let toy: NativeToy;
  let raised: unknown;

  beforeAll(async () => {
    // Install the native build INTO the tree the router was already pointed
    // at: the manifest is stamped through Manifest Wiring [15]'s own writer,
    // and the entry point is a real module that raises a real marked error.
    const home = join(tree.root, 'node_modules', TOY);
    writeFileSync(join(home, 'index.mjs'), nativeToySource(), 'utf8');
    stampManifestFile(join(home, 'package.json'), { version: '0.1', level: 1 });
    const loading = import(
      /* @vite-ignore */ pathToFileURL(join(home, 'index.mjs')).href
    ) as Promise<unknown> as Promise<NativeToy>;
    toy = await loading;
    try {
      toy.sortByCreatedAt();
    } catch (error) {
      raised = error;
    }
  });

  it('the generated native toy really speaks the protocol', () => {
    expect(toy.marker).toBe(COMPREHENDO_MARKER);
    expect(probe(raised)?.name).toBe(TOY);
    expect(raised).toMatchObject({ message: TOY_RAW });
  });

  it('the same router instance routes the newly native toy to native', () => {
    // No re-discovery, no new router, no configuration change: the marker on
    // the caught value is the authoritative channel and is read per call.
    expect(router.decideFor(TOY, raised).source).toBe('native');
    expect(router.decideFor(TOY, raised).discovery?.source).toBe('marker');
  });

  it('returns the toys own twin, never the sidecar twin', () => {
    const twin = router.comprehend(raised);

    expect(twin.code).toBe(NATIVE_CODE);
    expect(twin.fixes[0]?.title).toContain('Create the compound index');
    // The very same message still fingerprints to the sidecar corpus; what
    // changed is who is allowed to answer for it.
    expect(router.comprehend(new Error(TOY_RAW)).code).toBe(TOY_CODE);
  });

  it('a fresh discovery sees the native manifest stamped into the toy package.json', async () => {
    const stamped = readManifestFile(join(tree.root, 'node_modules', TOY, 'package.json'));
    const found = discoverInstalledCorpora(await discovery(tree.root));
    const fresh = createRouter(found);

    expect(stamped).toEqual({ status: 'declared', declaration: { version: '0.1', level: 1 } });
    // The advisory channel alone, on an unmarked error, is still native.
    expect(fresh.decideFor(TOY).source).toBe('native');
    expect(fresh.decideFor(TOY).discovery?.source).toBe('manifest');
    expect(fresh.comprehend(new Error(TOY_RAW)).code).toBe(UNSTRUCTURED_CODE);
  });

  it('prefer sidecar still routes the natively installed toy to the sidecar', () => {
    const preferring = createRouter(environment, { prefer: { [TOY]: 'sidecar' } });

    expect(preferring.decideFor(TOY, raised).source).toBe('sidecar');
    expect(preferring.comprehend(raised).code).toBe(TOY_CODE);
  });
});
