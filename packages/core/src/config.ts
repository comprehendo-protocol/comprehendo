/**
 * SKELETON (Phase 4, Red Gate). Types and signatures only; every body throws.
 * The real implementation lands in Phase 6.
 *
 * Manifest Wiring [15]: the provider-side static-discovery channel, the
 * `comprehendo` key in package.json and `[tool.comprehendo]` in pyproject.toml.
 */

import type { ComprehendoEntry, ComprehendoLevel, ComprehendoSurface } from './marker.js';
import type { ManifestDeclaration } from './sdk.js';

export type { ManifestDeclaration } from './sdk.js';

/** THE package.json key. Frozen literal, one definition site (CC9 [10]). */
export const MANIFEST_KEY = 'comprehendo';

/** THE pyproject.toml table. Frozen literal, one definition site (CC9 [10]). */
export const PYPROJECT_TABLE = 'tool.comprehendo';

/** Exactly the fields a provider-side declaration carries (manifest.schema.json). */
export const MANIFEST_FIELDS = Object.freeze(['version', 'level'] as const);

/** What a manifest read found: no claim, a readable claim, or a claim that could not be read. */
export type ManifestReading =
  | { readonly status: 'absent' }
  | { readonly status: 'declared'; readonly declaration: ManifestDeclaration }
  | { readonly status: 'unreadable'; readonly reason: string };

/** The resolved discovery view: what a tool should believe, and which channel it came from. */
export interface Discovery {
  readonly comprehendo: string;
  readonly level: ComprehendoLevel;
  readonly surfaces?: readonly ComprehendoSurface[];
  readonly source: 'marker' | 'manifest';
}

/** Both discovery channels, either of which may be missing. */
export interface DiscoveryInput {
  readonly marker?: ComprehendoEntry | undefined;
  readonly manifest?: ManifestDeclaration | undefined;
}

/** Raised when a manifest cannot be written (a bad declaration, an unreadable host file). */
export class ManifestError extends Error {
  public override readonly name = 'ManifestError';
}

export function declarationFor(entry: ComprehendoEntry): ManifestDeclaration {
  void entry;
  throw new Error('MDD skeleton: declarationFor is not implemented');
}

export function parseDeclaration(value: unknown): ManifestReading {
  void value;
  throw new Error('MDD skeleton: parseDeclaration is not implemented');
}

export function readPackageJson(text: string): ManifestReading {
  void text;
  throw new Error('MDD skeleton: readPackageJson is not implemented');
}

export function readPyproject(text: string): ManifestReading {
  void text;
  throw new Error('MDD skeleton: readPyproject is not implemented');
}

export function stampPackageJson(text: string, declaration: ManifestDeclaration): string {
  void text;
  void declaration;
  throw new Error('MDD skeleton: stampPackageJson is not implemented');
}

export function stampPyproject(text: string, declaration: ManifestDeclaration): string {
  void text;
  void declaration;
  throw new Error('MDD skeleton: stampPyproject is not implemented');
}

export function readManifestFile(path: string): ManifestReading {
  void path;
  throw new Error('MDD skeleton: readManifestFile is not implemented');
}

export function stampManifestFile(path: string, declaration: ManifestDeclaration): boolean {
  void path;
  void declaration;
  throw new Error('MDD skeleton: stampManifestFile is not implemented');
}

export function resolveDiscovery(input: DiscoveryInput): Discovery | undefined {
  void input;
  throw new Error('MDD skeleton: resolveDiscovery is not implemented');
}
