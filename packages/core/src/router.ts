// Router & Precedence [22]: the sidecar router.
//
// `comprehend(raw)` takes whatever the agent caught, an error object or bare
// stderr text, fingerprint-matches it against the installed
// `@comprehendo/<pkg>` corpora, and hands back a twin or an honest
// UNSTRUCTURED. `docs(pkg, query)` answers a docs question for a package that
// never adopted Comprehendo at all. Neither call needs one line of change in
// the target package: that is the whole point of the sidecar tier.
//
// This module is PURE. It routes against what is installed as DATA (an
// {@link Environment}, defined next door in `router-precedence.ts`) and
// imports no `node:` module, so "comprehend(raw) performs no I/O and has no
// observable side effects" is a property of the module rather than a promise
// in a comment. Reading a real node_modules tree into an Environment is
// `router-discovery.ts`'s job, on the other side of that seam. See
// JUDGMENT-22-router-precedence.md, call 1.
//
// @see .mdd/docs/22-router-precedence.md

import { COMPREHENDO_VERSION } from './docs.js';
import type { DocsResponse, Undocumented } from './docs.js';
import { probe } from './marker.js';
import type { ComprehendoEntry } from './marker.js';
import { createTwinBuilder, unstructuredTwin } from './twin.js';
import type { Twin, TwinBuilder } from './twin.js';
import { decideRoute } from './router-precedence.js';
import type { Environment, NativeEvidence, RouterConfig, RouterDecision } from './router-precedence.js';

// The ports, the environment shape and the precedence rule are re-exported
// here, so a consumer of the router imports one module (the same thing
// `fingerprint.ts` does with its facet half).
export * from './router-precedence.js';

// --- the router -------------------------------------------------------------

export interface Router {
  /** Whatever was caught in, a twin or UNSTRUCTURED out. No I/O, no side effects. */
  comprehend(raw: unknown): Twin;
  /** One topic-sized answer from an un-adopted package's installed corpus. */
  docs(pkg: string, query?: string): DocsResponse;
  /** Which tier answers for this package, and why. Pure, and inspectable on its own. */
  decideFor(pkg: string, raw?: unknown): RouterDecision;
  /** The target packages this router has a corpus for. */
  readonly packages: readonly string[];
}

const undocumented = (query: string): Undocumented =>
  Object.freeze({
    comprehendo: COMPREHENDO_VERSION,
    code: 'UNDOCUMENTED' as const,
    query,
    nearest: Object.freeze([]),
    source_permitted: true as const,
  });

/** A twin an adopted package attached to the error itself, if it really is one. */
function carriedTwin(raw: unknown): Twin | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const twin = (raw as { twin?: unknown }).twin;
  if (typeof twin !== 'object' || twin === null) return undefined;
  const shape = twin as Partial<Twin>;
  const usable =
    typeof shape.comprehendo === 'string' &&
    typeof shape.code === 'string' &&
    typeof shape.reason === 'string' &&
    Array.isArray(shape.fixes);
  return usable ? (twin as Twin) : undefined;
}

/**
 * Build a router over what is installed. Every corpus's twin builder is
 * constructed HERE, so Twin Builder [12]'s whole-catalog CC7 [09] gate runs
 * once, at construction: a corpus carrying a fix that escapes its provider's
 * declared call schema fails router creation rather than surfacing whenever
 * the matching error first happens to arrive.
 */
export function createRouter(environment: Environment, config: RouterConfig = {}): Router {
  const corpora = new Map(environment.corpora.map((corpus) => [corpus.package, corpus]));
  const builders = new Map<string, TwinBuilder>();
  for (const corpus of environment.corpora) {
    if (corpus.catalog !== undefined) builders.set(corpus.package, createTwinBuilder(corpus.catalog));
  }

  /**
   * The marker on the caught value is the authoritative channel and is read
   * at call time, for free: this is what makes an installed native
   * implementation flip precedence with no router reconfiguration.
   */
  const evidenceFor = (pkg: string, marker: ComprehendoEntry | undefined): NativeEvidence => {
    const stored = environment.native?.[pkg];
    const found = (marker?.name === pkg ? marker : undefined) ?? stored?.marker;
    return {
      ...(found === undefined ? {} : { marker: found }),
      ...(stored?.manifest === undefined ? {} : { manifest: stored.manifest }),
    };
  };

  const decideFor = (pkg: string, raw?: unknown): RouterDecision =>
    decideRoute(pkg, evidenceFor(pkg, probe(raw)), config);

  const comprehend = (raw: unknown): Twin => {
    const match = environment.matcher.match(raw);
    const marker = probe(raw);
    const pkg = marker?.name ?? (match.outcome === 'matched' ? match.entry.package : undefined);
    // Nothing claims it: the matcher's own honest miss, candidates and all.
    if (pkg === undefined) return match.outcome === 'matched' ? unstructuredTwin(raw) : match.twin;
    if (decideRoute(pkg, evidenceFor(pkg, marker), config).source === 'native') {
      // Defer: the package's own twin if it attached one, and otherwise the
      // same UNSTRUCTURED it would answer for a failure its catalog does not
      // cover. Never the sidecar's twin, which is exactly the CC8 violation
      // a helpful fallback would be.
      return carriedTwin(raw) ?? unstructuredTwin(raw);
    }
    if (match.outcome !== 'matched') return match.twin;
    const builder = builders.get(match.entry.package);
    return builder === undefined
      ? unstructuredTwin(raw)
      : builder.twinFor(match.entry.corpusEntryId, raw);
  };

  const docs = (pkg: string, query?: string): DocsResponse => {
    const surface = corpora.get(pkg)?.docs;
    if (surface !== undefined) return surface(query);
    // No corpus installed for this package: an empty menu, or an honest miss
    // that permits source for the one question asked. Never a throw, and
    // never an empty answer pretending to be one.
    return query === undefined ? Object.freeze({ topics: Object.freeze([]) }) : undocumented(query);
  };

  return Object.freeze({
    comprehend,
    docs,
    decideFor,
    packages: Object.freeze([...corpora.keys()]),
  });
}
