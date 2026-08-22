/**
 * SKELETON (Phase 4, Red Gate). Types and signatures only; every body throws.
 * The real implementation lands in Phase 6.
 *
 * SDK Entry [14]: makeProvider(corpus, hooks), the one call that turns a
 * packed corpus plus a few hooks into a Comprehendo-speaking provider.
 */

import type { ComprehendoEntry, ComprehendoLevel, ComprehendoSurface, Marked } from './marker.js';
import type { DocsOptions, DocsSurface, PackedCorpus } from './docs.js';
import type { ComprehendoError, ProviderCatalog, Twin, TwinBuilder, TwinContext } from './twin.js';

/** The provider-side manifest declaration (manifest.schema.json). Computed, never hand-set. */
export interface ManifestDeclaration {
  readonly version: string;
  readonly level: ComprehendoLevel;
}

/** What a resolver says about a raw failure: which cataloged code it is, and the throw site's own detail. */
export interface TwinResolution {
  readonly code: string;
  readonly context?: TwinContext;
}

/** One declared throw site: raw failure in, cataloged code out, `undefined` for "not mine". */
export type TwinResolver = (raw: unknown) => TwinResolution | undefined;

/** The honest abstention (unvalidatable.schema.json): `valid` is null, never a boolean. */
export interface Unvalidatable {
  readonly valid: null;
  readonly code: 'UNVALIDATABLE';
  readonly reason: string;
}

/** What `explain(input)` returns (explanation.schema.json). */
export interface Explanation {
  readonly would_execute: unknown;
  readonly notes?: readonly string[];
}

/** What `validate(input)` returns: clean, a cataloged twin, or an abstention. */
export type Validation = { readonly valid: true } | Twin | Unvalidatable;

/** What a `validate` hook hands back, before this SDK shapes it into a {@link Validation}. */
export type ValidationVerdict =
  | { readonly valid: true }
  | TwinResolution
  | { readonly unvalidatable: string };

export type ValidateHook = (input: unknown) => ValidationVerdict;

export type ExplainHook = (input: unknown) => Explanation;

/** Everything the provider knows that the corpus cannot carry. */
export interface ProviderHooks {
  readonly catalog: ProviderCatalog;
  readonly identity: string;
  readonly twinResolvers: readonly TwinResolver[];
  readonly name?: string;
  readonly priming?: string;
  readonly validate?: ValidateHook;
  readonly explain?: ExplainHook;
  readonly docs?: DocsOptions;
}

/** The object a package exports. Level 1 always; `validate`/`explain` only at Level 2. */
export interface Provider {
  readonly name: string;
  readonly comprehendo: string;
  readonly level: ComprehendoLevel;
  readonly surfaces: readonly ComprehendoSurface[];
  readonly entry: ComprehendoEntry;
  readonly manifest: ManifestDeclaration;
  readonly docs: DocsSurface;
  readonly twins: TwinBuilder;
  twinFor(raw: unknown, context?: TwinContext): Twin;
  errorFor(raw: unknown, context?: TwinContext): Error & ComprehendoError;
  raise(raw: unknown, context?: TwinContext): never;
  mark<T extends object>(target: T): Marked<T>;
  readonly validate?: (input: unknown) => Validation;
  readonly explain?: (input: unknown) => Explanation;
}

/** The RFC section 5.5 reference priming snippet, the default a provider ships. */
export const DEFAULT_PRIMING = '';

export function makeProvider(corpus: PackedCorpus, hooks: ProviderHooks): Marked<Provider> {
  void corpus;
  void hooks;
  throw new Error('MDD skeleton: makeProvider is not implemented');
}
