// Owner Endorsement [30]: the TARGET package's LIVE manifest, read.
//
// This is the channel the whole tier rests on. Nobody can claim to speak
// officially for a package they cannot publish to, so the only declaration
// worth reading is the one inside the package's own released manifest: the
// same `comprehendo` key Manifest Wiring [15] reads the native declaration
// from, and the same installed copy CC11 [25] / `verifyAgainstUpstream`
// induces failures out of. A declaration read from anywhere else, a corpus's
// own manifest, a PR description, a submitted file, proves nothing, because
// anyone can write it.
//
// WHICH COPY. The install root CI already produced for [29], which is a real
// `node_modules` tree with the real published package unpacked in it. This
// component fetches nothing: CC6 [27] forbids network code here, so the
// install is CI's step exactly as it is for `gate-upstream.ts`, and what
// arrives is a path. That is the same boundary, drawn once.
//
// NOTHING IS GUESSED AND NOTHING THROWS. A package that is not installed, a
// manifest that is not JSON, a declaration whose shape is wrong: each comes
// back as a snapshot carrying the reason. The endorsement decision then reads
// a value that says what it could not read, which is the only form in which a
// missing declaration can stay distinguishable from a declared absence.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Manifest Wiring [15]'s provider-side declaration, the top rung's evidence. */
export interface NativeDeclaration {
  readonly version: string;
  readonly level: number;
}

/** What the live manifest said, projected to what endorsement reads. */
export interface ManifestSnapshot {
  /** The package this snapshot was taken FOR, which is the corpus directory. */
  readonly package: string;
  /** What the manifest declares as its own name, when there was one to read. */
  readonly declaredName?: string;
  /** The released version this declaration shipped in. */
  readonly version?: string;
  /** `comprehendo.corpus`, exactly as declared. Read by `readPin`, not here. */
  readonly corpus?: string;
  /** `comprehendo.owners`, the readable entries. */
  readonly owners?: readonly string[];
  /** `comprehendo: {version, level}`, when the package speaks Comprehendo itself. */
  readonly native?: NativeDeclaration;
  /** Everything that could not be read, named. Never thrown. */
  readonly problems: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

/** The pin, kept in the owner's own spelling; whether it IS a sha256 is `readPin`'s. */
function readCorpusKey(block: Record<string, unknown>, problems: string[]): string | undefined {
  if (!('corpus' in block)) return undefined;
  const declared = block['corpus'];
  if (typeof declared !== 'string') {
    problems.push(
      `the live manifest's "comprehendo.corpus" must be a string, got ${typeof declared}`,
    );
    return undefined;
  }
  return declared;
}

/** The delegated identities. An unreadable entry is dropped BY NAME, never silently. */
function readOwnersKey(
  block: Record<string, unknown>,
  problems: string[],
): readonly string[] | undefined {
  if (!('owners' in block)) return undefined;
  const declared = block['owners'];
  if (!Array.isArray(declared)) {
    problems.push(
      `the live manifest's "comprehendo.owners" must be an array of identities, got ${typeof declared}`,
    );
    return undefined;
  }
  const kept = declared.filter((entry, at): entry is string => {
    if (typeof entry === 'string') return true;
    problems.push(
      `the live manifest's "comprehendo.owners" entry at index ${String(at)} is not an identity string`,
    );
    return false;
  });
  return Object.freeze(kept);
}

/** [15]'s two-field declaration, taken only when BOTH fields are really there. */
function readNativeKey(block: Record<string, unknown>): NativeDeclaration | undefined {
  const version = text(block['version']);
  const level = block['level'];
  if (version === undefined || typeof level !== 'number') return undefined;
  return Object.freeze({ version, level });
}

/**
 * Project a parsed manifest into the snapshot the endorsement record carries.
 * Pure: the same value, whether it came off a disk or out of a caller's hand.
 */
export function snapshotOf(pkg: string, manifest: unknown): ManifestSnapshot {
  const problems: string[] = [];
  if (!isRecord(manifest)) {
    problems.push(`the manifest for ${pkg} is not an object, so it declares nothing`);
    return Object.freeze({ package: pkg, problems: Object.freeze(problems) });
  }
  const declaredName = text(manifest['name']);
  const version = text(manifest['version']);
  const block = manifest['comprehendo'];
  if (block !== undefined && !isRecord(block)) {
    problems.push(
      `the live manifest's "comprehendo" key must be an object, got ${typeof block}`,
    );
  }
  const read = isRecord(block) ? block : {};
  const corpus = readCorpusKey(read, problems);
  const owners = readOwnersKey(read, problems);
  const native = readNativeKey(read);
  return Object.freeze({
    package: pkg,
    ...(declaredName === undefined ? {} : { declaredName }),
    ...(version === undefined ? {} : { version }),
    ...(corpus === undefined ? {} : { corpus }),
    ...(owners === undefined ? {} : { owners }),
    ...(native === undefined ? {} : { native }),
    problems: Object.freeze(problems),
  });
}

/**
 * The live manifest of the package CI really installed. The one door to a
 * disk in this component; everything downstream of it is a pure decision over
 * the value it returns.
 */
export function readTargetManifest(installRoot: string, directory: string): ManifestSnapshot {
  const path = join(installRoot, 'node_modules', ...directory.split('/'), 'package.json');
  if (!existsSync(path)) {
    return Object.freeze({
      package: directory,
      problems: Object.freeze([
        `no package named "${directory}" is installed at ${installRoot}, so its live manifest could not be read and nothing it might declare has been seen`,
      ]),
    });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return Object.freeze({
      package: directory,
      problems: Object.freeze([
        `the live manifest at ${path} is not readable JSON, so "${directory}" declares nothing this run: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ]),
    });
  }
  return snapshotOf(directory, parsed);
}
