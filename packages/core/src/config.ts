/**
 * Manifest Wiring [15]: the provider-side manifest declaration, written into
 * and read back out of the manifest each ecosystem already has (the
 * `comprehendo` key in package.json, `[tool.comprehendo]` in pyproject.toml).
 *
 * This is discovery channel two of four, and the only one that answers BEFORE
 * anything is imported: an agent, or a tool, can learn that a package speaks
 * Comprehendo by reading its manifest, with no code loaded and no side effect.
 * The marker (Marker & Probe [11]) is the runtime truth; this is the pre-import
 * truth, and it is ADVISORY. When the two disagree, {@link resolveDiscovery}
 * resolves in the marker's favor, always, per the conformance kit's own
 * disagreement fixture (Conformance Fixtures [04]).
 *
 * Two contracts land in this file:
 *
 * CC8, no provider veto. The declaration is exactly `{version, level}`
 * ({@link MANIFEST_FIELDS}), and every read here PROJECTS to those two fields.
 * A provider cannot express "do not use a registry corpus for my package",
 * because there is no field for it and nothing carries one through. That is a
 * structural guarantee, not a policy, and it is scanned for directly
 * (test/config-cc8.test.ts). CC8's runtime half (native beats sidecar, the
 * consumer `prefer` knob reverses it) is Router & Precedence [22]'s.
 *
 * CC9, frozen literals. The manifest key names are frozen literals with one
 * definition site each, exactly like the marker symbol: {@link MANIFEST_KEY}
 * and {@link PYPROJECT_TABLE} below, imported everywhere else.
 *
 * @see .mdd/docs/15-manifest-wiring.md
 * @see .mdd/docs/19-cc8-native-precedence.md
 * @see JUDGMENT-15-manifest-wiring.md
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import type { ComprehendoEntry, ComprehendoLevel, ComprehendoSurface } from './marker.js';
import type { ManifestDeclaration } from './sdk.js';

export type { ManifestDeclaration } from './sdk.js';

/** THE package.json key. Frozen literal, one definition site (CC9 [10]). */
export const MANIFEST_KEY = 'comprehendo';

/** THE pyproject.toml table. Frozen literal, one definition site (CC9 [10]). */
export const PYPROJECT_TABLE = 'tool.comprehendo';

/**
 * Exactly the fields a provider-side declaration carries
 * (manifest.schema.json), and the projection every read here applies. Adding a
 * third field is a CC8 [19] decision, not a convenience.
 */
export const MANIFEST_FIELDS = Object.freeze(['version', 'level'] as const);

/**
 * What a manifest read found. Three states, not two: "this package makes no
 * claim" and "this package makes a claim I could not read" are different
 * answers, and static discovery is exactly where conflating them turns a
 * broken manifest into a silent "does not speak Comprehendo".
 */
export type ManifestReading =
  | { readonly status: 'absent' }
  | { readonly status: 'declared'; readonly declaration: ManifestDeclaration }
  | { readonly status: 'unreadable'; readonly reason: string };

/** The resolved discovery view: what a tool should believe, and which channel it came from. */
export interface Discovery {
  readonly comprehendo: string;
  readonly level: ComprehendoLevel;
  /**
   * Present only from the marker. Static discovery cannot know which callable
   * surfaces exist, and `[]` would be a claim that none do.
   */
  readonly surfaces?: readonly ComprehendoSurface[];
  readonly source: 'marker' | 'manifest';
}

/** Both discovery channels, either of which may be missing. */
export interface DiscoveryInput {
  readonly marker?: ComprehendoEntry | undefined;
  readonly manifest?: ManifestDeclaration | undefined;
}

/**
 * Raised when a manifest cannot be WRITTEN: a declaration that would not
 * validate, host text that is not the format it claims to be, a file that is
 * not a manifest this component knows. Reading never throws; it reports
 * (see {@link ManifestReading}).
 */
export class ManifestError extends Error {
  public override readonly name = 'ManifestError';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Why this value is not a declaration, or `undefined` when it is one. The
 * reason names the offending FIELD, because the caller is usually a
 * maintainer looking at their own manifest.
 */
function declarationProblem(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return `the "${MANIFEST_KEY}" declaration must be an object, got ${describe(value)}`;
  }
  const version = value['version'];
  const level = value['level'];
  if (typeof version !== 'string' || version.trim() === '') {
    return `the "${MANIFEST_KEY}" declaration needs a non-empty string version, got ${describe(version)}`;
  }
  if (level !== 1 && level !== 2) {
    return `the "${MANIFEST_KEY}" declaration needs level 1 or 2 as an integer, got ${describe(level)}`;
  }
  return undefined;
}

/** What a value is, for an error message, without ever printing the value itself. */
function describe(value: unknown): string {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return `a ${typeof value}`;
}

/**
 * The projection CC8 rests on: whatever else rode along under the manifest key
 * (the endorsement keys of RFC 10.6, the consumer's own knobs, or a field a
 * provider invented), what comes out is these two fields and nothing else.
 */
function project(value: Record<string, unknown>): ManifestDeclaration {
  return Object.freeze({
    version: value['version'] as string,
    level: value['level'] as ComprehendoLevel,
  });
}

/** A declaration this component is about to WRITE, refused loudly when malformed. */
function assertDeclaration(declaration: ManifestDeclaration): ManifestDeclaration {
  const problem = declarationProblem(declaration);
  if (problem !== undefined) {
    throw new ManifestError(`comprehendo: refusing to stamp a manifest, ${problem}`);
  }
  return project(declaration as unknown as Record<string, unknown>);
}

/**
 * The declaration a provider stamps, read off the entry its own values carry.
 * Never hand-set: the level is what the runtime actually reached (SDK Entry
 * [14] computes it), so a manifest can only ever overclaim by drifting, never
 * by being authored.
 */
export function declarationFor(entry: ComprehendoEntry): ManifestDeclaration {
  return assertDeclaration({
    version: entry.comprehendo,
    level: entry.level,
  });
}

/** Read the value found AT the manifest key (or the pyproject table) as a declaration. */
export function parseDeclaration(value: unknown): ManifestReading {
  if (value === undefined) return { status: 'absent' };
  const problem = declarationProblem(value);
  if (problem !== undefined) return { status: 'unreadable', reason: problem };
  return { status: 'declared', declaration: project(value as Record<string, unknown>) };
}

/** Read the `comprehendo` key out of package.json text. Never throws. */
export function readPackageJson(text: string): ManifestReading {
  let host: unknown;
  try {
    host = JSON.parse(text) as unknown;
  } catch (error) {
    return {
      status: 'unreadable',
      reason: `package.json is not valid JSON: ${(error as Error).message}`,
    };
  }
  if (!isRecord(host)) {
    return { status: 'unreadable', reason: `a package.json must be a JSON object, got ${describe(host)}` };
  }
  if (!(MANIFEST_KEY in host)) return { status: 'absent' };
  return parseDeclaration(host[MANIFEST_KEY]);
}

/**
 * Write the declaration into package.json text, merging into whatever the key
 * already carries. It merges rather than replaces on purpose: the consumer's
 * five knobs (config.schema.json) and RFC 10.6's endorsement keys live under
 * this same key, and a provider-side stamp that replaced it would delete a
 * consumer's own configuration.
 *
 * @returns the new text: same indentation, same trailing newline, same field
 * order, with `version` and `level` set in place.
 */
export function stampPackageJson(text: string, declaration: ManifestDeclaration): string {
  const stamped = assertDeclaration(declaration);
  let host: unknown;
  try {
    host = JSON.parse(text) as unknown;
  } catch (error) {
    throw new ManifestError(
      `comprehendo: refusing to stamp a package.json that is not valid JSON: ${(error as Error).message}`,
    );
  }
  if (!isRecord(host)) {
    throw new ManifestError(
      `comprehendo: refusing to stamp a package.json that is not a JSON object, got ${describe(host)}`,
    );
  }
  const existing = host[MANIFEST_KEY];
  host[MANIFEST_KEY] = {
    ...(isRecord(existing) ? existing : {}),
    version: stamped.version,
    level: stamped.level,
  };
  const body = JSON.stringify(host, null, indentOf(text));
  return text.endsWith('\n') || text.trim() === '' ? `${body}\n` : body;
}

/** The indentation the file already used, so a stamp is not also a reformat. */
function indentOf(text: string): number | string {
  const found = /\n([ \t]+)"/.exec(text);
  const whitespace = found?.[1];
  if (whitespace === undefined) return 2;
  return whitespace.startsWith('\t') ? '\t' : whitespace.length;
}

export function readPyproject(text: string): ManifestReading {
  void text;
  throw new Error('MDD skeleton: readPyproject is not implemented');
}

export function stampPyproject(text: string, declaration: ManifestDeclaration): string {
  void text;
  void declaration;
  throw new Error('MDD skeleton: stampPyproject is not implemented');
}

export function readManifestFile(path: string): ManifestReading {
  void path;
  void readFileSync;
  void basename;
  throw new Error('MDD skeleton: readManifestFile is not implemented');
}

export function stampManifestFile(path: string, declaration: ManifestDeclaration): boolean {
  void path;
  void declaration;
  void writeFileSync;
  throw new Error('MDD skeleton: stampManifestFile is not implemented');
}

export function resolveDiscovery(input: DiscoveryInput): Discovery | undefined {
  void input;
  throw new Error('MDD skeleton: resolveDiscovery is not implemented');
}
