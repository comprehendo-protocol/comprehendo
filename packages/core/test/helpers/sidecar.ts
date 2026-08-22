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
