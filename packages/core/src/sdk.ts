// SDK Entry [14]: `makeProvider(corpus, hooks)`, the one call a package
// maintainer makes.
//
// This module composes the three Wave-2 pieces into the object a package
// exports: Marker & Probe [11] for discovery, Twin Builder [12] for the
// throw sites, Docs Engine [13] for `docs()`. It owns no protocol behavior of
// its own; what it owns is the WIRING, and two decisions that can only be
// made here:
//
//   1. The conformance level is COMPUTED from what `hooks` actually provided,
//      never declared by the maintainer. A provider that cannot judge without
//      executing omits `validate` entirely, so `'validate' in provider` is
//      false rather than a stub that always answers valid (RFC section 3,
//      Shape Schemas [03]).
//   2. The marker attached to the provider's export, to its raised errors,
//      and to its controlled handles is ONE frozen entry object, so probing
//      any value a package hands out answers with the same claim. This is the
//      integration point 12 left open: `attachTwin`'s `probeValue` defaults to
//      a bare `true`, which `probe()` reads back as "no marker"; here it gets
//      the real entry.
//
// @see .mdd/docs/14-sdk-entry.md
// @see JUDGMENT-14-sdk-entry.md

import { attachMarker, type ComprehendoEntry, type ComprehendoLevel } from './marker.js';
import type { ComprehendoSurface, Marked } from './marker.js';
import { createDocs, parsePackedCorpus } from './docs.js';
import type { DocsOptions, DocsSurface, PackedCorpus } from './docs.js';
import { SPEC_VERSION, attachTwin, createTwinBuilder, unstructuredTwin } from './twin.js';
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

/** Everything the provider knows that the packed corpus cannot carry. */
export interface ProviderHooks {
  /** The cataloged failures, the declared call surface, the corpus topics a fix may point at. */
  readonly catalog: ProviderCatalog;
  /** What the tool is, its completeness contract, its pointer (RFC section 5.5). Required. */
  readonly identity: string;
  /** The declared throw sites, in order. First claimant wins; none means UNSTRUCTURED. */
  readonly twinResolvers: readonly TwinResolver[];
  /**
   * The adoption snippet an agent is primed with (RFC section 5.5), under
   * CC5's 150-token cap. Required, and deliberately NOT defaulted here: the
   * reference snippet names the marker in prose, and a copy of that prose in
   * this package's source is a second `Symbol.for('comprehendo')` occurrence
   * to CC9 [10]'s one-definition-site scan, which reads source, not
   * semantics. Shipping the canonical snippet is Priming Snippet [36]'s job;
   * until then a provider passes its own (the conformance kit carries the
   * reference text as a measured fixture).
   */
  readonly priming: string;
  /** Defaults to the packed corpus's own `provider` name. */
  readonly name?: string;
  /** Judge without executing. Omit it when you cannot; never stub it. */
  readonly validate?: ValidateHook;
  /** Show what would run, without running it. Omit it when you cannot. */
  readonly explain?: ExplainHook;
  /** Passed through to the docs engine (log path, sink, clock). */
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

/** The clean verdict, one frozen instance: nothing about it varies per call. */
const CLEAN: Validation = Object.freeze({ valid: true as const });

const requireText = (value: string, field: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(
      `comprehendo: makeProvider() needs a non-empty ${field}. An entry without one ` +
        'is an entry no agent can orient from, and the marker would carry it anyway.',
    );
  }
  return value;
};

/** The throw site's own detail wins over what the resolver derived from the raw failure. */
const mergeContext = (
  derived: TwinContext | undefined,
  given: TwinContext | undefined,
): TwinContext | undefined =>
  derived === undefined && given === undefined ? undefined : { ...derived, ...given };

const isClean = (verdict: ValidationVerdict): verdict is { readonly valid: true } =>
  'valid' in verdict && verdict.valid === true;

const isAbstention = (verdict: ValidationVerdict): verdict is { readonly unvalidatable: string } =>
  'unvalidatable' in verdict && typeof verdict.unvalidatable === 'string';

const isResolution = (verdict: ValidationVerdict): verdict is TwinResolution =>
  'code' in verdict && typeof verdict.code === 'string';

/** Frozen so an explanation cannot be edited after the caller has been handed it. */
const freezeExplanation = (explanation: Explanation): Explanation => {
  if (explanation.notes !== undefined) Object.freeze(explanation.notes);
  return Object.freeze(explanation);
};

/**
 * The entry a provider's values will claim, computed from what `hooks`
 * actually provided. The level is a claim about the whole Level 2 SET, so it
 * takes both judge hooks; `surfaces` is a statement of what exists, so it
 * takes each on its own.
 */
function buildEntry(packed: PackedCorpus, hooks: ProviderHooks): ComprehendoEntry {
  const surfaces: ComprehendoSurface[] = ['docs'];
  if (hooks.validate !== undefined) surfaces.push('validate');
  if (hooks.explain !== undefined) surfaces.push('explain');
  return {
    comprehendo: SPEC_VERSION,
    name: requireText(hooks.name ?? packed.provider, 'name'),
    level: hooks.validate !== undefined && hooks.explain !== undefined ? 2 : 1,
    surfaces: Object.freeze(surfaces),
    identity: requireText(hooks.identity, 'identity'),
    priming: requireText(hooks.priming, 'priming'),
  };
}

/** The declared throw sites, in order: first claimant wins, none means UNSTRUCTURED. */
function twinSite(
  twins: TwinBuilder,
  resolvers: readonly TwinResolver[],
): (raw: unknown, context?: TwinContext) => Twin {
  return (raw: unknown, context?: TwinContext): Twin => {
    for (const resolver of resolvers) {
      const resolution = resolver(raw);
      if (resolution !== undefined) {
        return twins.build(resolution.code, mergeContext(resolution.context, context));
      }
    }
    // No declared throw site claims it: the honest wrapper, raw preserved.
    return unstructuredTwin(raw);
  };
}

/** A hook's verdict, shaped into the response `validate(input)` owes its caller. */
function shapeVerdict(twins: TwinBuilder, verdict: ValidationVerdict): Validation {
  if (isClean(verdict)) return CLEAN;
  if (isAbstention(verdict)) {
    return Object.freeze({
      valid: null,
      code: 'UNVALIDATABLE' as const,
      reason: verdict.unvalidatable,
    });
  }
  // A named code is built through the same catalog the throw sites use, so a
  // twin from `validate` is never hand-rolled and an unknown code fails loudly
  // instead of shipping a fix no gate ever checked.
  if (isResolution(verdict)) return twins.build(verdict.code, verdict.context);
  throw new TypeError(
    'comprehendo: the validate() hook returned a verdict this SDK cannot read. ' +
      'Return {valid: true}, {code, context?} naming a cataloged failure, or ' +
      '{unvalidatable: reason}. Defaulting to valid is the one answer a judge must never guess.',
  );
}

/**
 * Build a Comprehendo provider from a packed corpus and the hooks only the
 * provider can supply. The returned object carries the marker, answers
 * `docs()`, builds twins at its declared throw sites, and exposes
 * `validate`/`explain` exactly when `hooks` supplied the logic for them.
 *
 * Everything that can be refused is refused here, at construction: an
 * unreadable corpus, a catalog that violates CC3/CC7, a missing identity. A
 * provider either exists whole or does not exist.
 */
export function makeProvider(corpus: PackedCorpus, hooks: ProviderHooks): Marked<Provider> {
  const packed = parsePackedCorpus(corpus);
  const twins = createTwinBuilder(hooks.catalog);
  const entry = buildEntry(packed, hooks);
  const twinFor = twinSite(twins, hooks.twinResolvers);

  const errorFor = (raw: unknown, context?: TwinContext): Error & ComprehendoError => {
    const twin = twinFor(raw, context);
    // The entry, not `true`: a bare boolean is what `probe()` reads back as
    // "no marker", so the caught error would answer the probe with nothing.
    return attachTwin(new Error(twin.reason), twin, entry);
  };

  const judge = hooks.validate;
  const explainer = hooks.explain;

  const provider: Provider = {
    name: entry.name,
    comprehendo: entry.comprehendo,
    level: entry.level,
    surfaces: entry.surfaces,
    entry,
    manifest: Object.freeze({ version: SPEC_VERSION, level: entry.level }),
    docs: createDocs(packed, hooks.docs ?? {}),
    twins,
    twinFor,
    errorFor,
    raise: (raw: unknown, context?: TwinContext): never => {
      throw errorFor(raw, context);
    },
    mark: <T extends object>(target: T): Marked<T> => attachMarker(target, entry),
    ...(judge === undefined ? {} : { validate: (i: unknown) => shapeVerdict(twins, judge(i)) }),
    ...(explainer === undefined
      ? {}
      : { explain: (input: unknown) => freezeExplanation(explainer(input)) }),
  };

  const marked = attachMarker(provider, entry);
  Object.freeze(marked);
  return marked;
}
