// Twin Builder [12]: the throw-site twin construction path.
//
// Builds a twin from a cataloged failure, wraps a novel one as UNSTRUCTURED
// with the raw error preserved in `received` (CC3 [08]), and validates every
// `fixes[].apply` against the provider's declared call schema AT BUILD TIME,
// so a fix that would escape the schema fails the build rather than being
// caught at runtime, or not at all (CC7 [09]).
//
// This module is the surface consumers import: the checks themselves live in
// `twin-validate.ts` and are re-exported here. See
// JUDGMENT-12-twin-builder.md for the `apply`-grammar call and the marker
// integration point with Marker & Probe [11].

import {
  TwinCatalogError,
  UNSTRUCTURED_CODE,
  UNSTRUCTURED_REASON,
  rawTextOf,
  validateCatalog,
  violation,
} from './twin-validate.js';
import { COMPREHENDO_MARKER } from './marker.js';

export * from './twin-validate.js';
export { COMPREHENDO_MARKER };

/** The spec version this build implements, carried on every twin. */
export const SPEC_VERSION = '0.1';

export type Confidence = 'high' | 'likely' | 'guess';

/** One remedy on a twin (RFC 5.1.2). `apply` is literal provider call data. */
export interface Fix {
  readonly title: string;
  readonly apply?: unknown;
  readonly docs?: string;
  readonly confidence?: Confidence;
}

/** The structured form every failure arrives in (RFC 5.1.1). */
export interface Twin {
  readonly comprehendo: string;
  readonly code: string;
  readonly reason: string;
  readonly path?: string;
  readonly namespace?: string;
  readonly declared?: unknown;
  readonly received?: unknown;
  readonly accepts?: readonly string[];
  readonly fixes: readonly Fix[];
}

/**
 * The provider's own already-shipped call surface: what an `apply` is allowed
 * to express. `operations` is the exact vocabulary the CC7 gate checks
 * against, and it belongs to the provider, never to this builder.
 */
export interface DeclaredCallSchema {
  readonly surface: string;
  readonly operations: readonly string[];
}

/** One cataloged failure. `fixes` stays in the author's order, most-likely-first. */
export interface CatalogEntry {
  readonly code: string;
  readonly reason: string;
  readonly path?: string;
  readonly namespace?: string;
  readonly declared?: unknown;
  readonly received?: unknown;
  readonly accepts?: readonly string[];
  readonly fixes: readonly Fix[];
}

/** Everything the build-time gate needs: the call schema, the corpus index, the catalog. */
export interface ProviderCatalog {
  readonly declaredSchema: DeclaredCallSchema;
  readonly topics: readonly string[];
  readonly entries: readonly CatalogEntry[];
}

/** What the throw site knows that the catalog cannot: the actual input. */
export interface TwinContext {
  readonly path?: string;
  readonly namespace?: string;
  readonly declared?: unknown;
  readonly received?: unknown;
  readonly accepts?: readonly string[];
}

/** The documented surface: `err.twin` on a raised error. */
export interface ComprehendoError {
  readonly twin: Twin;
}

export interface TwinBuilder {
  readonly codes: readonly string[];
  has(code: string): boolean;
  build(code: string, context?: TwinContext): Twin;
  twinFor(code: string | undefined, raw?: unknown, context?: TwinContext): Twin;
  errorFor(code: string | undefined, raw?: unknown, context?: TwinContext): Error & ComprehendoError;
}

/**
 * What goes into `received`: the raw text when there is one, otherwise the
 * raw value unchanged. Never a stringified stand-in, the raw error is
 * preserved, never paraphrased away (CC3 [08]).
 */
const receivedOf = (raw: unknown): unknown => rawTextOf(raw) ?? raw;

/** Only-if-present, so an absent field never becomes an explicit undefined. */
const present = (key: string, value: unknown): Record<string, unknown> =>
  value === undefined ? {} : { [key]: value };

/** Frozen so a published code cannot be re-pointed after the fact (RFC 11). */
const freezeTwin = (twin: Twin): Twin => {
  twin.fixes.forEach((fix) => Object.freeze(fix));
  Object.freeze(twin.fixes);
  return Object.freeze(twin);
};

/**
 * The honest wrapper for a failure the corpus has no entry for: the raw error
 * preserved verbatim in `received`, a fixed reason that states the situation,
 * and no fix guessed at (CC3 [08], RFC 5.1.4).
 */
export function unstructuredTwin(raw: unknown): Twin {
  return freezeTwin({
    comprehendo: SPEC_VERSION,
    code: UNSTRUCTURED_CODE,
    reason: UNSTRUCTURED_REASON,
    ...present('received', receivedOf(raw)),
    fixes: [],
  });
}

/**
 * Attach a twin and the marker to an error the provider is about to raise.
 * `probeValue` is what a marker probe reads back; it defaults to `true`
 * (presence is the contract this module owns) and takes the provider's own
 * entry when SDK Entry [14] has one.
 */
export function attachTwin<E extends object>(
  error: E,
  twin: Twin,
  probeValue: unknown = true,
): E & ComprehendoError {
  Object.defineProperty(error, 'twin', {
    value: twin,
    enumerable: true,
    writable: false,
    configurable: false,
  });
  Object.defineProperty(error, COMPREHENDO_MARKER, {
    value: probeValue,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  return error as E & ComprehendoError;
}

/**
 * The provider's twin builder. Construction IS the gate: the whole catalog is
 * validated here, once, and a catalog with any violation raises instead of
 * returning a builder. Nothing re-validates per throw.
 */
export function createTwinBuilder(catalog: ProviderCatalog): TwinBuilder {
  const violations = validateCatalog(catalog);
  if (violations.length > 0) throw new TwinCatalogError(violations);

  // Author order is the corpus author's ordering decision, most-likely-first;
  // this builder never re-sorts fixes, it only carries them.
  const entries = new Map(catalog.entries.map((entry) => [entry.code, entry]));

  const build = (code: string, context?: TwinContext, raw?: unknown): Twin => {
    const entry = entries.get(code);
    if (entry === undefined) {
      throw new TwinCatalogError([
        violation(
          'CATALOG',
          'unknown-code',
          `build(${code})`,
          `${code} is not in this provider's catalog; an un-cataloged failure goes through twinFor, which wraps it as ${UNSTRUCTURED_CODE}`,
        ),
      ]);
    }
    return freezeTwin({
      comprehendo: SPEC_VERSION,
      code: entry.code,
      reason: entry.reason,
      ...present('path', context?.path ?? entry.path),
      ...present('namespace', context?.namespace ?? entry.namespace),
      ...present('declared', context?.declared ?? entry.declared),
      ...present('received', context?.received ?? entry.received ?? receivedOf(raw)),
      ...present('accepts', context?.accepts ?? entry.accepts),
      fixes: entry.fixes,
    });
  };

  const twinFor = (code: string | undefined, raw?: unknown, context?: TwinContext): Twin =>
    code !== undefined && entries.has(code) ? build(code, context, raw) : unstructuredTwin(raw);

  return Object.freeze({
    codes: Object.freeze([...entries.keys()]),
    has: (code: string) => entries.has(code),
    build: (code: string, context?: TwinContext) => build(code, context),
    twinFor,
    errorFor: (code: string | undefined, raw?: unknown, context?: TwinContext) => {
      const twin = twinFor(code, raw, context);
      // The message is the twin's reason, never the raw text (CC3 [08]):
      // `err.message` is the first thing anything prints.
      return attachTwin(new Error(twin.reason), twin);
    },
  });
}
