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
// The three artifact names are provisional, and deliberately so: Corpus
// Format [28] and Scoped Publisher [31] (Wave 5) own the published shape of a
// corpus package. They follow the one convention that already exists here,
// `comprehendo pack` writing `comprehendo.packed.json`. See
// JUDGMENT-22-router-precedence.md, call 1.
//
// @see .mdd/docs/22-router-precedence.md

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readManifestFile } from './config.js';
import type { ManifestReading } from './config.js';
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
 * The runtime artifacts an installed corpus package carries beside its own
 * package.json. Each is optional: a corpus with fingerprints and twins but no
 * docs still routes errors, and one with docs alone still answers questions.
 */
export const CORPUS_ARTIFACTS = Object.freeze({
  /** Fingerprint Index & Matcher [21]'s `serializeIndex` output. */
  fingerprints: 'comprehendo.fingerprints.json',
  /** The cataloged failures, as Twin Builder [12]'s `ProviderCatalog`. */
  twins: 'comprehendo.twins.json',
  /** Docs Engine [13]'s packed corpus, as `comprehendo pack` writes it. */
  docs: 'comprehendo.packed.json',
});

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
}

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

  const fingerprints = artifact(root, corpusPackage, 'fingerprints', fingerprintsIn, defects) ?? [];
  const catalog = artifact(root, corpusPackage, 'twins', catalogIn, defects);
  const docs = docsSurface(root, corpusPackage, options, defects);
  const version = typeof host['version'] === 'string' ? host['version'] : undefined;
  if (fingerprints.length === 0 && catalog === undefined && docs === undefined) {
    // Nothing routable. A package that CLAIMS to be a corpus (it declares
    // `comprehendoCorpus`) and carries no artifacts is a broken install and
    // is reported; anything else in this scope is simply not a corpus (the
    // registry tooling itself installs here too), and reporting that as a
    // defect every time would be crying wolf.
    if (isRecord(host['comprehendoCorpus'])) {
      defects.push({
        at: corpusPackage,
        detail: 'declares comprehendoCorpus but carries none of the three corpus artifacts',
      });
    }
    return undefined;
  }
  return {
    corpus: {
      package: target,
      corpusPackage,
      ...(catalog === undefined ? {} : { catalog }),
      ...(docs === undefined ? {} : { docs }),
      ...(version === undefined ? {} : { version }),
    },
    fingerprints,
  };
}

/** One named artifact, read and shaped, or a recorded defect and `undefined`. */
function artifact<T>(
  root: string,
  corpusPackage: string,
  name: keyof typeof CORPUS_ARTIFACTS,
  shape: (value: unknown) => T | string,
  defects: EnvironmentDefect[],
): T | undefined {
  const file = CORPUS_ARTIFACTS[name];
  const read = readJson(join(root, file));
  if (read.problem !== undefined) {
    defects.push({ at: `${corpusPackage}/${file}`, detail: read.problem });
    return undefined;
  }
  if (read.value === undefined) return undefined;
  const shaped = shape(read.value);
  if (typeof shaped === 'string') {
    defects.push({ at: `${corpusPackage}/${file}`, detail: shaped });
    return undefined;
  }
  return shaped;
}

function docsSurface(
  root: string,
  corpusPackage: string,
  options: DiscoveryOptions,
  defects: EnvironmentDefect[],
): InstalledCorpus['docs'] {
  const packed = artifact(
    root,
    corpusPackage,
    'docs',
    (value) => {
      try {
        return parsePackedCorpus(value);
      } catch (error) {
        return (error as Error).message;
      }
    },
    defects,
  );
  return packed === undefined ? undefined : createDocs(packed, options.docs ?? {});
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

  for (const directory of installed) {
    const loaded = loadCorpus(scope, directory, options, defects);
    if (loaded === undefined) continue;
    corpora.push(loaded.corpus);
    fingerprints.push(...loaded.fingerprints);
    const evidence = nativeEvidence(options.root, loaded.corpus.package, defects);
    if (evidence !== undefined) native[loaded.corpus.package] = evidence;
  }

  return Object.freeze({
    matcher: options.buildIndex(fingerprints),
    corpora: Object.freeze(corpora),
    native: Object.freeze(native),
    defects: Object.freeze(defects),
  });
}
