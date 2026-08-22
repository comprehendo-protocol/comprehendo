/**
 * Router & Precedence [22] test support: the real fingerprint matcher, and a
 * toy sidecar corpus assembled from fixtures that already exist.
 *
 * The matcher is Fingerprint Index & Matcher [21]'s REAL one, loaded from
 * `packages/registry-tools` through a computed specifier. Core cannot import
 * registry-tools statically (the dependency direction is one-way, and
 * `tsc --noEmit` rejects the cross-package path with TS6059), and a hand-written
 * double would agree with whatever the router did, which is the one thing a
 * matcher test must not do. So it is loaded at run time and typed against
 * core's own `CorpusMatcher` port: if 21's index ever stops satisfying that
 * port, every suite here fails.
 *
 * The corpus is the packed mongodb-operator artifact and the shared twin
 * catalog, standing in for an installed `@comprehendo/mongodb-operator`
 * published for a package that never adopted anything.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createDocs, loadPackedCorpus } from '../../src/docs.js';
import type { LookupRecord, PackedCorpus } from '../../src/docs.js';
import { attachMarker } from '../../src/marker.js';
import type { ComprehendoEntry } from '../../src/marker.js';
import type {
  CorpusMatcher,
  Environment,
  InstalledCorpus,
  NativeEvidence,
} from '../../src/router.js';
import { attachTwin, unstructuredTwin } from '../../src/twin.js';
import type { Twin } from '../../src/twin.js';
import { catalog, sortEntry } from './catalog.js';
import { PACKAGE_ROOT } from './source-scan.js';

/** The un-adopted target package the sidecar corpus is published FOR. */
export const TOY = 'mongodb-operator';

/** The corpus package as it would be installed. */
export const TOY_CORPUS_PACKAGE = `@comprehendo/${TOY}`;

/** The raw driver text the corpus has a cataloged entry for. */
export const TOY_RAW = 'Sort exceeded memory limit of 33554432 bytes';

/** A raw failure nothing in the corpus covers. */
export const TOY_RAW_NOVEL = 'connection 4 to cluster0-shard-00-02 closed';

export const TOY_CODE = 'SORT_UNINDEXED_SPILL';

/** The corpus's declared fingerprint for that entry. */
export const TOY_FINGERPRINT = Object.freeze({
  package: TOY,
  corpusEntryId: TOY_CODE,
  messagePattern: 'Sort exceeded memory limit of * bytes',
});

/** A second corpus's fingerprint that ALSO matches TOY_RAW: the ambiguity case. */
export const RIVAL_FINGERPRINT = Object.freeze({
  package: 'other-store',
  corpusEntryId: 'MEMORY_CEILING',
  messagePattern: '* memory limit of * bytes',
});

/** 21's index, plus the two artifact functions this suite writes and reads. */
export interface RealIndex extends CorpusMatcher {
  readonly entries: readonly unknown[];
}

interface FingerprintModule {
  readonly buildFingerprintIndex: (source: Iterable<unknown>) => RealIndex;
  readonly serializeIndex: (index: RealIndex) => string;
  readonly parseFingerprintIndex: (text: string) => RealIndex;
}

const MATCHER_SOURCE = join(PACKAGE_ROOT, '..', 'registry-tools', 'src', 'fingerprint.ts');

let loading: Promise<FingerprintModule> | undefined;

/** Fingerprint Index & Matcher [21]'s real module, loaded once. */
export async function fingerprintModule(): Promise<FingerprintModule> {
  loading ??= import(/* @vite-ignore */ pathToFileURL(MATCHER_SOURCE).href) as Promise<unknown> as Promise<FingerprintModule>;
  return loading;
}

/** A real compiled index over the given corpus fingerprints. */
export async function realMatcher(entries: readonly unknown[]): Promise<RealIndex> {
  const { buildFingerprintIndex } = await fingerprintModule();
  return buildFingerprintIndex(entries);
}

/** The packed artifact the toy corpus package ships, read from the kit-adjacent fixture. */
export function toyPacked(): PackedCorpus {
  return loadPackedCorpus(join(PACKAGE_ROOT, 'test', 'fixtures', 'mongodb-operator.packed.json'));
}

/** One installed corpus, with its docs lookups collected instead of written to a file. */
export function toyInstalled(lookups: LookupRecord[] = []): InstalledCorpus {
  return {
    package: TOY,
    corpusPackage: TOY_CORPUS_PACKAGE,
    catalog: catalog(sortEntry),
    docs: createDocs(toyPacked(), { sink: (record) => lookups.push(record) }),
  };
}

export interface EnvironmentOptions {
  readonly fingerprints?: readonly unknown[];
  readonly corpora?: readonly InstalledCorpus[];
  readonly native?: Readonly<Record<string, NativeEvidence>>;
}

/** The default environment: one installed corpus, one fingerprint, nothing native. */
export async function toyEnvironment(options: EnvironmentOptions = {}): Promise<Environment> {
  return {
    matcher: await realMatcher(options.fingerprints ?? [TOY_FINGERPRINT]),
    corpora: options.corpora ?? [toyInstalled()],
    ...(options.native === undefined ? {} : { native: options.native }),
  };
}

/** The entry a natively adopted toy would attach to everything it hands out. */
export function nativeEntry(name: string = TOY): ComprehendoEntry {
  return {
    comprehendo: '0.1',
    name,
    level: 1,
    surfaces: ['docs'],
    identity: `${name} is the toy package this suite routes against.`,
    priming: 'The packages in this project speak Comprehendo. Probe the caught error.',
  };
}

/** A twin only a native implementation could have produced. */
export function nativeTwin(reason: string): Twin {
  return Object.freeze({
    comprehendo: '0.1',
    code: 'NATIVE_SORT_SPILL',
    reason,
    fixes: Object.freeze([Object.freeze({ title: 'the native fix, not the sidecar one' })]),
  });
}

/** An error as an adopted package raises it: its own twin, and the marker. */
export function markedError(message: string, twin?: Twin): Error {
  return attachTwin(new Error(message), twin ?? unstructuredTwin(message), nativeEntry());
}

/** An error carrying the marker but no twin of its own. */
export function markedBare(message: string): Error {
  return attachMarker(new Error(message), nativeEntry());
}

// --- a real installed tree ---------------------------------------------------

/** The twin the generated NATIVE toy raises. Only a native implementation has it. */
export const NATIVE_CODE = 'NATIVE_SORT_SPILL';

const trees: string[] = [];

/** A real project root with a real node_modules, on a real disk. */
export interface Tree {
  readonly root: string;
  /** Write an installed `@comprehendo/<target>` corpus package. */
  installCorpus(files: Readonly<Record<string, string>>, directory?: string): string;
  /** Write an installed target package's package.json. */
  installTarget(name: string, manifest?: Readonly<Record<string, unknown>>): string;
  /** Path inside the tree. */
  path(...segments: string[]): string;
}

export function makeTree(): Tree {
  const root = mkdtempSync(join(tmpdir(), 'comprehendo-router-'));
  trees.push(root);
  const path = (...segments: string[]): string => join(root, ...segments);
  const write = (file: string, text: string): void => {
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text, 'utf8');
  };
  return {
    root,
    path,
    installCorpus(files, directory = TOY) {
      const home = path('node_modules', '@comprehendo', directory);
      for (const [name, text] of Object.entries(files)) write(join(home, name), text);
      return home;
    },
    installTarget(name, manifest = {}) {
      const home = path('node_modules', ...name.split('/'));
      write(join(home, 'package.json'), `${JSON.stringify({ name, version: '1.4.0', ...manifest }, null, 2)}\n`);
      return home;
    },
  };
}

/** Delete every temp tree this suite made. */
export function cleanTrees(): void {
  for (const root of trees.splice(0)) rmSync(root, { recursive: true, force: true });
}

/**
 * The files a published `@comprehendo/<toy>` corpus package ships, built with
 * the real tools: 21's `serializeIndex` for the fingerprint artifact, the
 * shared twin catalog for the twins, and the packed corpus 13 reads.
 */
export async function toyCorpusFiles(): Promise<Record<string, string>> {
  const { serializeIndex } = await fingerprintModule();
  return {
    'package.json': `${JSON.stringify(
      { name: TOY_CORPUS_PACKAGE, version: '0.3.1', comprehendoCorpus: { target: TOY } },
      null,
      2,
    )}\n`,
    'comprehendo.fingerprints.json': serializeIndex(await realMatcher([TOY_FINGERPRINT])),
    'comprehendo.twins.json': `${JSON.stringify(catalog(sortEntry), null, 2)}\n`,
    'comprehendo.packed.json': `${JSON.stringify(toyPacked(), null, 2)}\n`,
  };
}

/**
 * The source of a real, natively adopted toy: an ESM package that attaches the
 * well-known marker and its own twin to the error it raises. It cannot import
 * core's TypeScript source (Node loads a module written outside this package
 * with its own loader, not the test runner's transform), so it speaks the
 * protocol directly, exactly as an independent package would. The suite
 * asserts the symbol it uses is identical to core's COMPREHENDO_MARKER.
 */
export function nativeToySource(): string {
  const entry = nativeEntry();
  const twin = {
    comprehendo: '0.1',
    code: NATIVE_CODE,
    reason: 'The sort spilled to disk; the native build knows which index would satisfy it.',
    received: TOY_RAW,
    fixes: [{ title: 'Create the compound index this sort needs', confidence: 'high' }],
  };
  return [
    "const MARKER = Symbol.for('comprehendo');",
    `const entry = Object.freeze(${JSON.stringify(entry)});`,
    `const twin = Object.freeze(${JSON.stringify(twin)});`,
    'export const marker = MARKER;',
    'export function sortByCreatedAt() {',
    `  const error = new Error(${JSON.stringify(TOY_RAW)});`,
    "  Object.defineProperty(error, 'twin', { value: twin, enumerable: true });",
    '  Object.defineProperty(error, MARKER, { value: entry, enumerable: false });',
    '  throw error;',
    '}',
    '',
  ].join('\n');
}
