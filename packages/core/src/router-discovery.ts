// Router & Precedence [22], the environment adapter: what is actually
// installed, read off a real disk.
//
// This is the other side of the seam `router.ts` describes. Everything here
// touches the filesystem, and nothing here decides anything: it walks one
// directory level of `node_modules/@comprehendo`, loads each installed corpus
// package's declared artifacts, reads each TARGET package's own manifest
// through Manifest Wiring [15], and hands back an {@link Environment} the
// pure router routes against. That split is what lets `comprehend(raw)` be
// side-effect free while "installed" still means installed, on a real disk,
// rather than a fixture someone typed.
//
// It never walks a corpus SOURCE tree (Corpus Format [28] forbids runtime
// code from doing that, and it is the wrong shape besides): it enumerates
// installed packages, then loads named artifacts only.
//
// The published artifact this file reads is Corpus Format [28]'s ruling
// (`comprehendo.corpus.json`, `corpus_packed: 1`), not the three-file
// provisional convention this module shipped with at Wave 4. `registry-tools`
// takes no runtime import from core (the dependency direction is one-way), so
// the shape is read structurally here rather than through 28's real
// `readPackedCorpus`, the same duplicate-plus-shape-check pattern `catalogIn`
// and `fingerprintsIn` already use below. `CORPUS_ARTIFACT` and
// `CORPUS_PACKED_FORMAT` are pinned to 28's own literal values
// (`corpus-format.ts`), which is what a drift test can check even without an
// import.
//
// @see .mdd/docs/22-router-precedence.md
// @see .mdd/docs/28-corpus-format.md

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { readManifestFile } from './config.js';
import type { ManifestReading } from './config.js';
import { localCorpusMounts } from './config-consumer.js';
import type { ConsumerConfig } from './config-consumer.js';
import { createDocs, parsePackedCorpus } from './docs.js';
import type { DocsOptions } from './docs.js';
import type {
  CorpusMatcher,
  Environment,
  EnvironmentDefect,
  InstalledCorpus,
  NativeEvidence,
} from './router-precedence.js';
import type { ProviderCatalog } from './twin.js';

/** The npm scope every registry corpus is published under. */
export const CORPUS_SCOPE = '@comprehendo';

/**
 * The one runtime artifact an installed corpus package carries beside its own
 * package.json, Corpus Format [28]'s ruling. Fingerprints, twins and docs are
 * all inside it; none is a separate file any more.
 */
export const CORPUS_ARTIFACT = 'comprehendo.corpus.json';

/** The whole-artifact format version 28 versions independently of its docs half. */
export const CORPUS_PACKED_FORMAT = 1;

/** The corpus package's own declaration of what it is a corpus FOR. */
export interface CorpusDescriptor {
  /** The target package name, when it cannot be spelled as `@comprehendo/<pkg>`. */
  readonly target?: string;
}

export interface DiscoveryOptions {
  /** The consuming project root: the directory whose `node_modules` is read. */
  readonly root: string;
  /**
   * Fingerprint Index & Matcher [21]'s `buildFingerprintIndex`, injected
   * because the dependency direction is one-way (registry-tools -> core).
   * Its refusals are deliberately NOT caught: a fingerprint collision between
   * two installed corpora is exactly the thing that must fail loudly.
   */
  readonly buildIndex: (entries: Iterable<unknown>) => CorpusMatcher;
  /** Passed through to Docs Engine [13] (log path, sink, clock). */
  readonly docs?: DocsOptions;
  /** Restrict discovery to these target packages, when the caller knows. */
  readonly only?: readonly string[];
  /**
   * The consuming project's own knobs (Config Loader [23]). Only `local` is
   * read here, because only `local` changes what EXISTS; the other four are
   * routing decisions and are handed to `createRouter` instead.
   */
  readonly config?: ConsumerConfig;
}

/** How a private corpus's package is named: not a registry package, and never published. */
export const LOCAL_CORPUS_PREFIX = 'local:';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON off disk, or the reason there is none. Never throws. */
function readJson(path: string): { value?: unknown; problem?: string } {
  if (!existsSync(path)) return {};
  try {
    return { value: JSON.parse(readFileSync(path, 'utf8')) as unknown };
  } catch (error) {
    return { problem: (error as Error).message };
  }
}

/** The `fingerprints` array out of a compiled index artifact. */
function fingerprintsIn(value: unknown): readonly unknown[] | string {
  if (!isRecord(value)) return 'the fingerprint artifact is not an object';
  const fingerprints = value['fingerprints'];
  return Array.isArray(fingerprints)
    ? (fingerprints as readonly unknown[])
    : 'the fingerprint artifact carries no fingerprints array';
}

/**
 * A structural read of a twin catalog. The REAL gate is Twin Builder [12]'s,
 * which `createRouter` runs over the whole catalog at construction; this only
 * keeps a file of the wrong shape from being handed to it as one.
 */
function catalogIn(value: unknown): ProviderCatalog | string {
  if (!isRecord(value)) return 'the twin catalog is not an object';
  const schema = value['declaredSchema'];
  if (!isRecord(schema) || typeof schema['surface'] !== 'string') {
    return 'the twin catalog declares no call surface';
  }
  if (!Array.isArray(value['entries'])) return 'the twin catalog carries no entries array';
  return value as unknown as ProviderCatalog;
}

/**
 * The `docs` half of a packed artifact, shaped through Docs Engine [13]'s own
 * `parsePackedCorpus`: it is verbatim 13's `packed: 1` format (Corpus Format
 * [28]'s ruling), so 13's own parser IS the acceptance test for it, no second
 * shape check invented here.
 */
function docsHalfOf(value: unknown): ReturnType<typeof parsePackedCorpus> | string {
  try {
    return parsePackedCorpus(value);
  } catch (error) {
    return (error as Error).message;
  }
}

/** The target package a corpus package is published for. */
function targetOf(corpusPackage: string, manifest: unknown): string {
  const descriptor = isRecord(manifest) ? manifest['comprehendoCorpus'] : undefined;
  const declared = isRecord(descriptor) ? descriptor['target'] : undefined;
  if (typeof declared === 'string' && declared.trim() !== '') return declared;
  return corpusPackage.slice(CORPUS_SCOPE.length + 1);
}

interface LoadedCorpus {
  readonly corpus: InstalledCorpus;
  readonly fingerprints: readonly unknown[];
}

/**
 * The one artifact, read and version-gated. `undefined` with no defect means
 * "no artifact here at all" (not every directory in scope is a corpus); a
 * `problem` string means something was there and wrong, always reported.
 */
function readCorpusArtifact(root: string): { value?: Record<string, unknown>; problem?: string } {
  const read = readJson(join(root, CORPUS_ARTIFACT));
  if (read.problem !== undefined) return { problem: read.problem };
  if (read.value === undefined) return {};
  if (!isRecord(read.value)) return { problem: `${CORPUS_ARTIFACT} is not an object` };
  const version = read.value['corpus_packed'];
  if (typeof version !== 'number') {
    return { problem: `${CORPUS_ARTIFACT} declares no "corpus_packed" format version` };
  }
  if (version !== CORPUS_PACKED_FORMAT) {
    return {
      problem: `${CORPUS_ARTIFACT} is corpus_packed version ${String(version)}; this build reads version ${String(CORPUS_PACKED_FORMAT)}`,
    };
  }
  return { value: read.value };
}

/**
 * One corpus, loaded off a directory. Installed under `node_modules` or
 * mounted from the consuming project's own tree (`local`, Config Loader [23]),
 * it is the same one artifact read the same way: Corpus Generator [17] and
 * Corpus Format [28]'s `pack` serve a private corpus with no second code
 * path, so there is none here either. `whenEmpty` is the defect to report
 * when nothing routable was found, or `undefined` when a directory carrying
 * no artifact is simply not a corpus.
 */
function loadCorpusFrom(
  root: string,
  corpusPackage: string,
  target: string,
  version: string | undefined,
  whenEmpty: string | undefined,
  options: DiscoveryOptions,
  defects: EnvironmentDefect[],
): LoadedCorpus | undefined {
  const read = readCorpusArtifact(root);
  if (read.problem !== undefined) {
    defects.push({ at: `${corpusPackage}/${CORPUS_ARTIFACT}`, detail: read.problem });
    return undefined;
  }
  if (read.value === undefined) {
    if (whenEmpty !== undefined) defects.push({ at: corpusPackage, detail: whenEmpty });
    return undefined;
  }
  const packed = read.value;
  const fingerprints = shapeOf(fingerprintsIn(packed), corpusPackage, defects) ?? [];
  const catalog = 'twins' in packed ? shapeOf(catalogIn(packed['twins']), corpusPackage, defects) : undefined;
  const docs =
    'docs' in packed ? shapeOf(docsHalfOf(packed['docs']), corpusPackage, defects) : undefined;
  return {
    corpus: {
      package: target,
      corpusPackage,
      ...(catalog === undefined ? {} : { catalog }),
      ...(docs === undefined ? {} : { docs: createDocs(docs, options.docs ?? {}) }),
      ...(version === undefined ? {} : { version }),
    },
    fingerprints,
  };
}

/** A structural read's result: the shaped value, or a reported defect. */
function shapeOf<T>(
  shaped: T | string,
  corpusPackage: string,
  defects: EnvironmentDefect[],
): T | undefined {
  if (typeof shaped === 'string') {
    defects.push({ at: `${corpusPackage}/${CORPUS_ARTIFACT}`, detail: shaped });
    return undefined;
  }
  return shaped;
}

/** One installed corpus package, loaded. Anything unreadable becomes a defect. */
function loadCorpus(
  scope: string,
  directory: string,
  options: DiscoveryOptions,
  defects: EnvironmentDefect[],
): LoadedCorpus | undefined {
  const root = join(scope, directory);
  const corpusPackage = `${CORPUS_SCOPE}/${directory}`;
  const manifest = readJson(join(root, 'package.json'));
  if (manifest.value === undefined) {
    defects.push({
      at: corpusPackage,
      detail: manifest.problem ?? 'has no readable package.json, so it is not an installed package',
    });
    return undefined;
  }
  const host = isRecord(manifest.value) ? manifest.value : {};
  const target = targetOf(corpusPackage, host);
  if (options.only !== undefined && !options.only.includes(target)) return undefined;

  // A package that CLAIMS to be a corpus (it declares `comprehendoCorpus`) and
  // carries no artifacts is a broken install and is reported; anything else in
  // this scope is simply not a corpus (the registry tooling itself installs
  // here too), and reporting that every time would be crying wolf.
  const whenEmpty = isRecord(host['comprehendoCorpus'])
    ? `declares comprehendoCorpus but carries no ${CORPUS_ARTIFACT}`
    : undefined;
  const version = typeof host['version'] === 'string' ? host['version'] : undefined;
  return loadCorpusFrom(root, corpusPackage, target, version, whenEmpty, options, defects);
}

/**
 * One private corpus the consumer mounted for an internal package. Nothing
 * about it is published: it is not in `node_modules`, it carries no registry
 * scope, and the only thing that knows it exists is the consumer's own
 * `local` knob. The path is theirs, so an empty or missing one is always a
 * defect: they named it, and a silent skip would read as "no corpus written".
 */
function loadLocalCorpus(
  target: string,
  path: string,
  options: DiscoveryOptions,
  defects: EnvironmentDefect[],
): LoadedCorpus | undefined {
  const corpusPackage = `${LOCAL_CORPUS_PREFIX}${target}`;
  const root = isAbsolute(path) ? path : resolve(options.root, path);
  if (!existsSync(root)) {
    defects.push({
      at: corpusPackage,
      detail: `is mounted at ${path}, and there is no directory there`,
    });
    return undefined;
  }
  const manifest = readJson(join(root, 'package.json'));
  const host = isRecord(manifest.value) ? manifest.value : {};
  const version = typeof host['version'] === 'string' ? host['version'] : undefined;
  return loadCorpusFrom(
    root,
    corpusPackage,
    target,
    version,
    `is mounted at ${path}, which carries no ${CORPUS_ARTIFACT}`,
    options,
    defects,
  );
}

/**
 * What the TARGET package's own manifest says, if it is installed at all. The
 * advisory channel (Manifest Wiring [15]): a package that has adopted
 * Comprehendo natively declares `{version, level}` here, and this read is
 * projected down to those two fields before it ever reaches a decision, which
 * is why no provider-side field can suppress a corpus (CC8 [19]).
 */
function nativeEvidence(
  root: string,
  target: string,
  defects: EnvironmentDefect[],
): NativeEvidence | undefined {
  const manifest = join(root, 'node_modules', ...target.split('/'), 'package.json');
  if (!existsSync(manifest)) return undefined;
  let reading: ManifestReading;
  try {
    reading = readManifestFile(manifest);
  } catch (error) {
    // A path that EXISTS but cannot be READ (a directory sitting where the
    // file should be, a permissions error) is not "no evidence", it is
    // evidence this adapter failed to read. Found by review: silently
    // returning undefined here meant a real natively-adopted package with a
    // transiently unreadable manifest lost precedence to the sidecar with
    // zero diagnostic trail, the exact "reported, never silently skipped"
    // rule every other unreadable-artifact path in this file already
    // follows (see loadCorpus/artifact above).
    defects.push({
      at: target,
      detail: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
  return reading.status === 'absent' ? undefined : { manifest: reading };
}

/**
 * Read a real installed tree into an {@link Environment}.
 *
 * One index is compiled over EVERY installed corpus, not one per corpus, so a
 * fingerprint two corpora both claim is visible as an ambiguity (CC10 [20])
 * rather than resolved by whichever happened to load first.
 */
export function discoverInstalledCorpora(options: DiscoveryOptions): Environment {
  const scope = join(options.root, 'node_modules', CORPUS_SCOPE);
  const defects: EnvironmentDefect[] = [];
  const corpora: InstalledCorpus[] = [];
  const fingerprints: unknown[] = [];
  const native: Record<string, NativeEvidence> = {};

  const installed = existsSync(scope)
    ? readdirSync(scope, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
        .map((entry) => entry.name)
        .sort()
    : [];

  const mounted = localCorpusMounts(options.config ?? {}).filter(
    ([target]) => options.only === undefined || options.only.includes(target),
  );

  const loaded = [
    ...installed.map((directory) => loadCorpus(scope, directory, options, defects)),
    // Private corpora go into the SAME list, and their fingerprints into the
    // same index below: a failure text a private corpus and a published one
    // both claim has to surface as an ambiguity (CC10 [20]), not be resolved
    // by which of the two happened to load first.
    ...mounted.map(([target, path]) => loadLocalCorpus(target, path, options, defects)),
  ];

  for (const found of loaded) {
    if (found === undefined) continue;
    corpora.push(found.corpus);
    fingerprints.push(...found.fingerprints);
    // `defects` is required here (found by 22's review): a target manifest
    // that exists but cannot be read must surface as a defect, never
    // silently lose native evidence. 23's branch was cut before that fix
    // landed on wave-4, so its own call had regressed to the 2-arg form;
    // restored on merge.
    const evidence = nativeEvidence(options.root, found.corpus.package, defects);
    if (evidence !== undefined) native[found.corpus.package] = evidence;
  }

  return Object.freeze({
    matcher: options.buildIndex(fingerprints),
    corpora: Object.freeze(corpora),
    native: Object.freeze(native),
    defects: Object.freeze(defects),
  });
}
