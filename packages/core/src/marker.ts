/**
 * Marker and probe: how any value from a Comprehendo-speaking package tells
 * the agent holding it that it understands more than its plain type suggests.
 *
 * Discovery channel one of four (the other three are the manifest, the
 * package's COMPREHENDO.md, and the twin's own `comprehendo` field): the
 * marker rides on the provider's root export, on every raised error, and on
 * controlled handles, so the failure the agent is already looking at is a
 * discovery moment.
 *
 * Two cross-cutting contracts land in this file:
 *
 * CC9, marker freeze. The marker literal has exactly one definition site, here
 * (the constant below). Every other module in every tier imports it. It is
 * never assembled at run time and never re-exported under a second name; at
 * run time an assembled key and a literal one produce the identical symbol, so
 * a source scan is the only thing that can tell them apart.
 *
 * CC1, probe purity. Probing does no I/O, mutates nothing, and allocates
 * nothing: it is one property read handing back the entry the provider
 * attached. This module imports nothing, so there is no transitive path in
 * which that could stop being true.
 *
 * @see .mdd/docs/11-marker-probe.md
 * @see .mdd/docs/07-cc1-probe-purity.md
 * @see .mdd/docs/10-cc9-marker-freeze.md
 */

/**
 * THE definition site. Frozen literal, one per implementation (CC9). Import
 * this constant, never write the literal again, never compute it.
 */
export const COMPREHENDO_MARKER: unique symbol = Symbol.for('comprehendo');

/** The callable surfaces a provider offers. Twins are unconditional, so they are not listed. */
export type ComprehendoSurface = 'docs' | 'validate' | 'explain' | 'comprehend';

/** Conformance level: 1 is twins plus docs plus identity, 2 adds validate and explain. */
export type ComprehendoLevel = 1 | 2;

/**
 * What a successful probe hands back: the entry's data fields, exactly the set
 * `entry.schema.json` requires. In JavaScript the same object also carries the
 * provider's callable surfaces, which no JSON Schema can describe; a provider
 * type extends this one to declare them.
 */
export interface ComprehendoEntry {
  /** The spec version this provider implements, e.g. `0.1`. */
  readonly comprehendo: string;
  /** The provider's own name. */
  readonly name: string;
  /** The conformance level actually achieved, never aspirational. */
  readonly level: ComprehendoLevel;
  /** The callable surfaces that exist. A provider that cannot judge omits `validate`. */
  readonly surfaces: readonly ComprehendoSurface[];
  /** What the tool is, the completeness contract, and the pointer, in that order. */
  readonly identity: string;
  /** The adoption snippet, under 150 tokens. */
  readonly priming: string;
}

/** A value carrying the marker. The property is non-enumerable, so it never serializes. */
export type Marked<T extends object> = T & {
  readonly [COMPREHENDO_MARKER]: ComprehendoEntry;
};

/**
 * Attach the marker to a provider's root export, to an error about to be
 * thrown, or to a controlled handle. Attachment happens at construction or
 * throw time, never lazily on first access: the marker is written as a data
 * property, so presence is decided once and cannot vary between probes.
 *
 * The entry (and its `surfaces` list) is frozen here, so the claim a value
 * makes about itself cannot be edited afterwards by anything holding it.
 *
 * Idempotent for the same entry. Attaching a DIFFERENT entry to an already
 * marked value throws: a value whose marker could change is a value whose
 * probe result is non-deterministic, which is the failure this component
 * exists to rule out.
 *
 * @returns the same object, now typed as marked. Never a copy.
 */
export function attachMarker<T extends object>(target: T, entry: ComprehendoEntry): Marked<T> {
  const existing = probe(target);
  if (existing !== undefined) {
    if (existing !== entry) {
      throw new TypeError(
        'comprehendo: this value already carries a different Comprehendo entry. ' +
          'The marker is attached once, at construction or throw time.',
      );
    }
    return target as Marked<T>;
  }

  Object.defineProperty(target, COMPREHENDO_MARKER, {
    value: freezeEntry(entry),
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return target as Marked<T>;
}

/**
 * Probe any value for the marker: an export, a caught error, a handle. One
 * property read, no I/O, no mutation, no allocation, and it never throws,
 * whatever it is handed (a revoked proxy and a booby-trapped getter both
 * answer "no marker", which is the honest answer for a value whose claim
 * cannot be read).
 *
 * @returns the entry the provider attached, or `undefined` for anything else.
 */
export function probe(value: unknown): ComprehendoEntry | undefined {
  if (value === null) {
    return undefined;
  }
  const kind = typeof value;
  if (kind !== 'object' && kind !== 'function') {
    return undefined;
  }

  let carried: unknown;
  try {
    carried = (value as { [COMPREHENDO_MARKER]?: unknown })[COMPREHENDO_MARKER];
  } catch {
    return undefined;
  }

  return isEntry(carried) ? carried : undefined;
}

/**
 * The one-line form of {@link probe} for callers that only need to branch:
 * does this value speak Comprehendo. Same single property read, same purity.
 */
export function hasMarker(value: unknown): boolean {
  return probe(value) !== undefined;
}

/**
 * A structural guard, not schema validation (that is the conformance kit's
 * job): it keeps `probe` from handing back whatever happens to occupy the
 * marker key on a value that never spoke the protocol.
 */
function isEntry(candidate: unknown): candidate is ComprehendoEntry {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const entry = candidate as Partial<ComprehendoEntry>;
  return (
    typeof entry.comprehendo === 'string' &&
    typeof entry.name === 'string' &&
    (entry.level === 1 || entry.level === 2) &&
    Array.isArray(entry.surfaces) &&
    typeof entry.identity === 'string' &&
    typeof entry.priming === 'string'
  );
}

/** Freeze in place and return the same object, so entry identity survives. */
function freezeEntry(entry: ComprehendoEntry): ComprehendoEntry {
  if (!Object.isFrozen(entry.surfaces)) {
    Object.freeze(entry.surfaces);
  }
  return Object.isFrozen(entry) ? entry : Object.freeze(entry);
}
