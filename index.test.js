// The root npm package's real public surface, exercised through a REAL
// `npm pack` -> extract -> import cycle, never a relative-path shortcut
// that a real `npm install comprehendo` would not actually give a
// consumer: `files` in package.json is an allowlist, and the only way to
// prove it is complete is to build the real tarball and import from what
// is really inside it.
//
// Requires packages/core to be built first (`npm run build`, which this
// package's own pretest runs); a missing dist fails this test naming the
// real ENOENT rather than a mock standing in for it.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, it } from 'node:test';

const REPO_ROOT = import.meta.dirname;

let packageRoot;
let pkg;
let core;

before(async () => {
  const packDir = mkdtempSync(join(tmpdir(), 'comprehendo-pack-'));
  // --pack-destination writes the real tarball outside the repo, so a
  // stray comprehendo-*.tgz never ends up committed by accident.
  const stdout = execFileSync(
    'npm',
    ['pack', '--json', '--pack-destination', packDir],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  const [{ filename }] = JSON.parse(stdout);
  const extractDir = mkdtempSync(join(tmpdir(), 'comprehendo-extract-'));
  execFileSync('tar', ['xzf', join(packDir, filename), '-C', extractDir]);
  packageRoot = join(extractDir, 'package');
  rmSync(packDir, { recursive: true, force: true });

  pkg = await import(pathToFileURL(join(packageRoot, 'index.js')).href);
  core = await import(
    pathToFileURL(join(packageRoot, 'packages', 'core', 'dist', 'index.js')).href
  );
});

after(() => {
  if (packageRoot !== undefined) rmSync(join(packageRoot, '..'), { recursive: true, force: true });
});

describe('the packed tarball is genuinely self-contained', () => {
  it('really contains packages/core/dist, not just index.js', () => {
    const distFiles = readdirSync(join(packageRoot, 'packages', 'core', 'dist'));

    assert.ok(distFiles.includes('index.js'), 'the real published tarball must ship the built SDK');
  });
});

describe('makeProvider: the provider SDK entry', () => {
  it('is a real function, not a stub string return, and is core\'s own', () => {
    assert.equal(typeof pkg.makeProvider, 'function');
    assert.equal(pkg.makeProvider, core.makeProvider);
  });
});

describe('createDocs: docs() over an already-loaded packed corpus', () => {
  const corpus = Object.freeze({
    comprehendo: '0.1',
    packed: 1,
    provider: 'toy-provider',
    index: Object.freeze(['widgets']),
    topics: Object.freeze({
      widgets: Object.freeze({
        topic: 'widgets',
        summary: 'How to register a widget.',
        vocabularies_served: Object.freeze({
          own_terms: Object.freeze(['widget']),
          translations: Object.freeze([]),
          task: Object.freeze(['register a widget']),
        }),
      }),
    }),
  });

  it('answers the real index with no query', () => {
    const docs = pkg.createDocs(corpus, { sink: () => undefined });

    assert.deepEqual(docs(), { topics: ['widgets'] });
  });

  it('answers a real topic-sized response for a real query', () => {
    const docs = pkg.createDocs(corpus, { sink: () => undefined });

    const answer = docs('widgets');
    assert.equal(answer.topic, 'widgets');
    assert.equal(answer.summary, 'How to register a widget.');
  });

  it('answers UNDOCUMENTED, honestly, for a topic this corpus does not carry', () => {
    const docs = pkg.createDocs(corpus, { sink: () => undefined });

    const answer = docs('a question about nothing in this corpus');
    assert.equal(answer.code, 'UNDOCUMENTED');
    assert.equal(answer.source_permitted, true);
  });
});

describe('createRouter: comprehend(raw) and docs(pkg, query) over an Environment', () => {
  // No installed corpora at all: this proves the router's own honest-miss
  // and UNDOCUMENTED paths for real, with no filesystem or fingerprint
  // index needed. A real matched twin needs a real CorpusMatcher (Fingerprint
  // Index & Matcher [21]'s buildFingerprintIndex, which lives in
  // @comprehendo/registry-tools, not yet a standalone published package;
  // see README.md's Known gap), so that path is exercised in
  // packages/core's own test suite, not here.
  const emptyEnvironment = Object.freeze({
    matcher: Object.freeze({
      match: (raw) => ({
        outcome: 'miss',
        twin: {
          comprehendo: '0.1',
          code: 'UNSTRUCTURED',
          reason: 'No cataloged twin matched this value.',
          received: String(raw),
          fixes: [],
        },
        candidates: [],
      }),
    }),
    corpora: Object.freeze([]),
  });

  it('comprehend(raw) on nothing installed returns an honest UNSTRUCTURED, not a throw', () => {
    const router = pkg.createRouter(emptyEnvironment);

    const twin = router.comprehend(new Error('anything at all'));
    assert.equal(twin.code, 'UNSTRUCTURED');
  });

  it("docs(pkg, query) on a package with no installed corpus returns UNDOCUMENTED", () => {
    const router = pkg.createRouter(emptyEnvironment);

    const answer = router.docs('toy-widgets', 'how do I register a widget');
    assert.equal(answer.code, 'UNDOCUMENTED');
  });

  it('is the same createRouter packages/core/dist/index.js exports', () => {
    assert.equal(pkg.createRouter, core.createRouter);
  });
});

describe('discoverInstalledCorpora: reading a real node_modules tree', () => {
  it('reads a real empty project root and finds nothing, honestly, not a throw', () => {
    const root = mkdtempSync(join(tmpdir(), 'comprehendo-discover-'));
    try {
      const environment = pkg.discoverInstalledCorpora({
        root,
        buildIndex: () => ({ match: () => ({ outcome: 'miss', twin: undefined, candidates: [] }) }),
      });

      assert.deepEqual(environment.corpora, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('the config loader: the five consumer knobs', () => {
  it('exports the real CONFIG_KNOBS and TRUST_LEVELS constants', () => {
    assert.deepEqual([...pkg.CONFIG_KNOBS], ['prefer', 'pin', 'disable', 'require', 'local']);
    assert.deepEqual([...pkg.TRUST_LEVELS], ['community', 'endorsed', 'native']);
  });

  it('parseConsumerConfig reads a real per-package prefer knob, not a stub', () => {
    const read = pkg.parseConsumerConfig({ prefer: { 'toy-widgets': 'sidecar' } });

    assert.deepEqual(read.problems, []);
    assert.equal(read.config.prefer['toy-widgets'], 'sidecar');
  });
});
