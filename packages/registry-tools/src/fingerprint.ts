// Fingerprint Index & Matcher [21].
//
// The static fingerprint index: compiled ONCE at registry build time from a
// corpus's declared fingerprints (error-class names, message patterns, stack
// shapes) and never mutated afterwards. There is no runtime learning here and
// no scoring heuristic to drift: an entry matches when EVERY facet it declares
// matches, and two entries surviving that test is an ambiguity, not a ranking
// problem.
//
// Precision-first, per CC10 Honest Miss [20]: an ambiguous or near-miss lookup
// returns UNSTRUCTURED with the considered candidates NAMED, never a confident
// wrong twin. A wrong twin is worse than no twin.
//
// A fingerprint collision across two packages' corpora refuses to build and
// names the colliding packages. That check lives here, in the builder, because
// it is the builder's own invariant; Submission Gate [29] (Wave 5) calls it
// from CI later.
//
// The pure facet checks live in `fingerprint-facets.ts` and are re-exported
// here, so Router & Precedence [22] imports one module. See
// JUDGMENT-21-fingerprint-index-matcher.md for the pattern-language,
// unobservable-facet and shape-duplication calls.

import {
  isRecord,
  judge,
  nameOf,
  normalizeEntry,
  observe,
  rawTextOf,
  signatureOf,
  type FingerprintCandidate,
  type FingerprintEntry,
  type IndexDefect,
} from './fingerprint-facets.js';

export * from './fingerprint-facets.js';

/** The UNSTRUCTURED twin shape (RFC 5.1.4), as `unstructuredTwin()` builds it. */
export interface UnstructuredTwin {
  readonly comprehendo: string;
  readonly code: 'UNSTRUCTURED';
  readonly reason: string;
  readonly received: unknown;
  /** The candidates considered and rejected. Absent when there were none. */
  readonly accepts?: readonly string[];
  readonly fixes: readonly [];
}

export type MatchResult =
  | {
      readonly outcome: 'matched';
      readonly entry: FingerprintEntry;
      readonly candidates: readonly FingerprintCandidate[];
    }
  | {
      readonly outcome: 'ambiguous' | 'miss';
      readonly twin: UnstructuredTwin;
      readonly candidates: readonly FingerprintCandidate[];
    };

export interface FingerprintIndex {
  readonly entries: readonly FingerprintEntry[];
  match(raw: unknown): MatchResult;
}

// --- the UNSTRUCTURED shape, duplicated from core under a drift test --------

/**
 * Copies of `packages/core/src/twin.ts`'s SPEC_VERSION and
 * `twin-validate.ts`'s UNSTRUCTURED_CODE / UNSTRUCTURED_REASON. registry-tools
 * is a build-time tool and takes no dependency on core's runtime module, so
 * the literals are duplicated; per the duplication rule the copy is held to
 * the original by test/unstructured-shape-drift.test.ts, which reads core's
 * source and asserts both values match.
 */
export const SPEC_VERSION = '0.1';
export const UNSTRUCTURED_CODE = 'UNSTRUCTURED';
export const UNSTRUCTURED_REASON =
  'This failure is not yet in the corpus; the underlying message is preserved verbatim in received, and no fix is being guessed at.';

/**
 * The honest answer: the raw error preserved verbatim in `received`, the
 * considered-and-rejected candidates in `accepts`, and no fix guessed at.
 */
export function unstructuredTwin(raw: unknown, candidates: readonly string[]): UnstructuredTwin {
  const twin: UnstructuredTwin = {
    comprehendo: SPEC_VERSION,
    code: UNSTRUCTURED_CODE,
    reason: UNSTRUCTURED_REASON,
    received: rawTextOf(raw) ?? raw,
    ...(candidates.length > 0 ? { accepts: Object.freeze([...candidates]) } : {}),
    fixes: Object.freeze([]),
  };
  return Object.freeze(twin);
}

// --- refusals ---------------------------------------------------------------

/** Two entries claiming one fingerprint. Named, never resolved by picking. */
export interface FingerprintCollision {
  readonly fingerprint: string;
  readonly packages: readonly string[];
  readonly entries: readonly string[];
  readonly crossPackage: boolean;
}

export class FingerprintIndexError extends Error {
  readonly defects: readonly IndexDefect[];

  constructor(defects: readonly IndexDefect[]) {
    super(
      `fingerprint index refused to build: ${defects.map((d) => `${d.at}: ${d.detail}`).join('; ')}`,
    );
    this.name = 'FingerprintIndexError';
    this.defects = Object.freeze([...defects]);
  }
}

export class FingerprintCollisionError extends Error {
  readonly collisions: readonly FingerprintCollision[];

  constructor(collisions: readonly FingerprintCollision[]) {
    super(
      `fingerprint index refused to build, ${collisions.length} collision(s): ${collisions
        .map(
          (c) =>
            `${c.entries.join(' and ')} (package${c.packages.length > 1 ? 's' : ''} ${c.packages.join(', ')}) declare the same fingerprint ${c.fingerprint}`,
        )
        .join('; ')}. The registry build never picks one.`,
    );
    this.name = 'FingerprintCollisionError';
    this.collisions = Object.freeze([...collisions]);
  }
}

// --- the builder ------------------------------------------------------------

/** Deterministic order, so the compiled artifact is a function of its input. */
const byIdentity = (a: FingerprintEntry, b: FingerprintEntry): number =>
  a.package === b.package
    ? a.corpusEntryId < b.corpusEntryId
      ? -1
      : a.corpusEntryId > b.corpusEntryId
        ? 1
        : 0
    : a.package < b.package
      ? -1
      : 1;

/** Every fingerprint claimed by more than one corpus entry. */
function collisionsIn(entries: readonly FingerprintEntry[]): readonly FingerprintCollision[] {
  const bySignature = new Map<string, Map<string, FingerprintEntry>>();
  for (const entry of entries) {
    const signature = signatureOf(entry);
    const claimants = bySignature.get(signature) ?? new Map<string, FingerprintEntry>();
    // Keyed by name, so one entry declared twice is one claim, not a collision.
    claimants.set(nameOf(entry), entry);
    bySignature.set(signature, claimants);
  }
  const collisions: FingerprintCollision[] = [];
  for (const [fingerprint, claimants] of bySignature) {
    if (claimants.size < 2) continue;
    const packages = [...new Set([...claimants.values()].map((entry) => entry.package))].sort();
    collisions.push(
      Object.freeze({
        fingerprint,
        packages: Object.freeze(packages),
        entries: Object.freeze([...claimants.keys()].sort()),
        crossPackage: packages.length > 1,
      }),
    );
  }
  return collisions;
}

/**
 * Two entries sharing an identity (`package#corpusEntryId`) whose declared
 * facets DISAGREE: same defect class as any other "two entries, one
 * identity" case this feature refuses, found by review. Without this check,
 * the dedup step below (`new Map(entries.map(e => [nameOf(e), e]))`) picks
 * whichever one happens to appear last in iteration order and silently
 * drops the other, which is exactly the silent-pick failure mode the
 * collision detector exists to prevent, just on the id axis instead of the
 * fingerprint-signature axis. Two entries sharing BOTH id and facets
 * (identical in every way) are one entry declared twice, not a conflict.
 */
function identityDefects(entries: readonly FingerprintEntry[]): readonly IndexDefect[] {
  const seen = new Map<string, FingerprintEntry>();
  const defects: IndexDefect[] = [];
  for (const entry of entries) {
    const name = nameOf(entry);
    const existing = seen.get(name);
    if (existing === undefined) {
      seen.set(name, entry);
      continue;
    }
    if (signatureOf(existing) !== signatureOf(entry)) {
      defects.push({
        at: name,
        detail:
          `${name} is declared more than once with DIFFERENT fingerprints; ` +
          'the registry build cannot pick one, each corpus entry ID must ' +
          'name exactly one fingerprint',
      });
    }
  }
  return defects;
}

/**
 * Compile the static index. Refuses on a defective entry
 * (`FingerprintIndexError`) and on any fingerprint claimed by two different
 * corpus entries (`FingerprintCollisionError`), naming the packages. An
 * identical entry declared twice is one entry, not a collision.
 */
export function buildFingerprintIndex(source: Iterable<unknown>): FingerprintIndex {
  const defects: IndexDefect[] = [];
  const entries: FingerprintEntry[] = [];
  let at = 0;
  for (const value of source) {
    const normalized = normalizeEntry(value, `entry[${at}]`);
    at += 1;
    if (Array.isArray(normalized)) defects.push(...(normalized as IndexDefect[]));
    else entries.push(normalized as FingerprintEntry);
  }
  defects.push(...identityDefects(entries));
  if (defects.length > 0) throw new FingerprintIndexError(defects);

  const collisions = collisionsIn(entries);
  if (collisions.length > 0) throw new FingerprintCollisionError(collisions);

  const compiled = Object.freeze(
    [...new Map(entries.map((entry) => [nameOf(entry), entry])).values()].sort(byIdentity),
  );
  return Object.freeze({
    entries: compiled,
    match: (raw: unknown): MatchResult => match(compiled, raw),
  });
}

// --- the matcher ------------------------------------------------------------

/**
 * Precision-first lookup. An entry matches only when every facet it declares
 * matches; one survivor is the answer, two or more is an ambiguity and degrades
 * to UNSTRUCTURED with both named (CC10 [20]), and none degrades to
 * UNSTRUCTURED naming whatever was close enough to be considered.
 */
function match(entries: readonly FingerprintEntry[], raw: unknown): MatchResult {
  const seen = observe(raw);
  const full: FingerprintEntry[] = [];
  const fullCandidates: FingerprintCandidate[] = [];
  const near: FingerprintCandidate[] = [];
  for (const entry of entries) {
    if ((entry.kind ?? 'runtime-error') !== 'runtime-error') continue;
    const candidate = judge(entry, seen);
    if (candidate.rejectedOn.length === 0) {
      full.push(entry);
      fullCandidates.push(candidate);
    } else if (candidate.matched.length > 0) {
      near.push(candidate);
    }
  }
  const only = full[0];
  if (full.length === 1 && only !== undefined) {
    return Object.freeze({
      outcome: 'matched',
      entry: only,
      candidates: Object.freeze(fullCandidates),
    });
  }
  const candidates = Object.freeze(
    (full.length > 1 ? fullCandidates : near)
      .slice()
      .sort(
        (a, b) =>
          b.matched.length - a.matched.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
      ),
  );
  return Object.freeze({
    outcome: full.length > 1 ? 'ambiguous' : 'miss',
    twin: unstructuredTwin(
      raw,
      candidates.map((candidate) => candidate.name),
    ),
    candidates,
  });
}

// --- the compiled artifact --------------------------------------------------

/** The serialized form: one static artifact, byte-identical for equal input. */
export function serializeIndex(index: FingerprintIndex): string {
  return JSON.stringify(
    {
      comprehendo: SPEC_VERSION,
      fingerprints: index.entries.map((entry) => ({
        package: entry.package,
        ...(entry.errorClass !== undefined ? { errorClass: entry.errorClass } : {}),
        ...(entry.messagePattern !== undefined ? { messagePattern: entry.messagePattern } : {}),
        ...(entry.stackShape !== undefined ? { stackShape: [...entry.stackShape] } : {}),
        corpusEntryId: entry.corpusEntryId,
        ...(entry.kind !== undefined ? { kind: entry.kind } : {}),
      })),
    },
    null,
    2,
  );
}

/** Load a compiled artifact, running the same refusals the builder runs. */
export function parseFingerprintIndex(text: string): FingerprintIndex {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new FingerprintIndexError([{ at: 'artifact', detail: 'not valid JSON' }]);
  }
  const fingerprints = isRecord(parsed) ? parsed['fingerprints'] : undefined;
  if (!Array.isArray(fingerprints))
    throw new FingerprintIndexError([
      { at: 'artifact.fingerprints', detail: 'missing or not an array' },
    ]);
  return buildFingerprintIndex(fingerprints as readonly unknown[]);
}
