// Upstream Watch [34]: the lock file over a wrapped tool's surface.
//
// A corpus for a tool the registry does not own is a set of claims about
// somebody else's release schedule. This module is the format those claims are
// recorded in: one entry per surface element the corpus actually depends on, a
// flag, a behavior, or a stderr pattern, each carrying the version it was
// observed against, when it was observed, what it traces back to in the
// corpus, and the probe that re-observes it.
//
// GENERIC ON PURPOSE. Nothing here knows what ffmpeg is. A probe names a
// `program`, an `argv`, an optional named `fixture` and an optional named
// `capture`, all as plain strings, and the vocabulary of those names belongs to
// the tool-specific probe runner (for ffmpeg, the registry-tools test tree),
// which refuses a name it does not know rather than guessing. That split is
// what lets the next `@comprehendo/<pkg>` sidecar over a tool it does not own
// reuse this file unchanged, which the feature doc asks for explicitly.
//
// NOT A PARSER OF THE AUTHORING CORPUS. Corpus Format [28] owns that. This
// reads one file, `upstream-watch.lock`, that sits beside a corpus and points
// back into it through `tracesTo`; the pointer is resolved by whoever holds
// both, never here.

import { existsSync, readFileSync } from 'node:fs';

/** Which of the three surface-element kinds an entry locks. */
export type LockElementKind = 'flag' | 'behavior' | 'stderrPattern';

/** The three kinds, in the order the doc's data model names them. */
export const LOCK_ELEMENT_KINDS: readonly LockElementKind[] = Object.freeze([
  'flag',
  'behavior',
  'stderrPattern',
]);

/** A named reading taken from a file the probe produced, after the run. */
export interface LockCapture {
  /** A reader name the tool-specific runner knows, e.g. `dimensions`. */
  readonly read: string;
  /** The file, relative to the probe's workspace, the reading is taken from. */
  readonly file: string;
}

/** How one locked element is re-observed against the tool as installed now. */
export interface LockProbe {
  /** The executable to run. Resolved by the runner, never by this module. */
  readonly program: string;
  /** The argument vector, minus the program name. Never a shell string. */
  readonly argv: readonly string[];
  /** A named workspace fixture the runner builds before the run, if any. */
  readonly fixture?: string;
  readonly capture?: LockCapture;
}

/** What the probe observed when the element was locked. */
export interface LockExpectation {
  /** The exit status the probe really returned, when it is load-bearing. */
  readonly status?: number;
  /** A literal fragment the probe's stderr really carried. */
  readonly stderrIncludes?: string;
  /** A literal fragment the probe's stderr really did NOT carry. */
  readonly stderrExcludes?: string;
  /** The value the probe's `capture` really read. */
  readonly capture?: string;
}

/**
 * One locked surface element: exactly one of `flag`, `behavior` or
 * `stderrPattern`, plus when and against what it was observed.
 */
export interface LockEntry {
  readonly flag?: string;
  readonly behavior?: string;
  readonly stderrPattern?: string;
  /** The tool version string this element was really observed against. */
  readonly lockedVersion: string;
  /** The day it was observed, ISO `YYYY-MM-DD`. */
  readonly observedAt: string;
  /**
   * Where this element is depended on in the corpus: `twin:<CODE>`,
   * `fix:<twinId>#<index>`, `topic:<name>`, `schema:<operation>`. Never empty:
   * a lock file that grows past what the corpus depends on is a maintenance
   * cost with no failure behind it.
   */
  readonly tracesTo: readonly string[];
  readonly probe: LockProbe;
  readonly expect: LockExpectation;
}

/** The lock file itself. */
export interface UpstreamLock {
  readonly comprehendo: string;
  readonly upstreamWatch: 1;
  readonly provider: string;
  /** The wrapped tool, as the corpus manifest's `target.package` names it. */
  readonly target: string;
  /** The version the last full observation ran against. */
  readonly lockedVersion: string;
  readonly observedAt: string;
  readonly entries: readonly LockEntry[];
}

/** A lock file that cannot be read as one. Never a silent default. */
export class UpstreamLockError extends Error {
  public override readonly name = 'UpstreamLockError';
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringAt = (record: Record<string, unknown>, key: string, at: string): string => {
  const value = record[key];
  if (typeof value !== 'string' || value === '') {
    throw new UpstreamLockError(`${at}: ${key} is required and must be a non-empty string`);
  }
  return value;
};

const stringsAt = (record: Record<string, unknown>, key: string, at: string): readonly string[] => {
  const value = record[key];
  if (!Array.isArray(value) || !value.every((one) => typeof one === 'string')) {
    throw new UpstreamLockError(`${at}: ${key} must be a list of strings`);
  }
  return Object.freeze([...value]);
};

/** Which kind an entry locks, refusing zero and refusing two. */
export function elementKindOf(entry: LockEntry, at = 'entry'): LockElementKind {
  const present = LOCK_ELEMENT_KINDS.filter((kind) => entry[kind] !== undefined);
  const only = present[0];
  if (only === undefined || present.length !== 1) {
    throw new UpstreamLockError(
      `${at}: a lock entry names exactly one of flag, behavior or stderrPattern, this one names ${String(present.length)}`,
    );
  }
  return only;
}

/** The element's name, which is what a drift record is reported against. */
export function subjectOf(entry: LockEntry): string {
  return entry[elementKindOf(entry)] ?? '';
}

function readCapture(value: unknown, at: string): LockCapture | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new UpstreamLockError(`${at}: capture must be an object`);
  return Object.freeze({
    read: stringAt(value, 'read', `${at}.capture`),
    file: stringAt(value, 'file', `${at}.capture`),
  });
}

function readProbe(value: unknown, at: string): LockProbe {
  if (!isRecord(value)) throw new UpstreamLockError(`${at}: probe is required and is an object`);
  const capture = readCapture(value['capture'], at);
  const fixture = value['fixture'];
  if (fixture !== undefined && typeof fixture !== 'string') {
    throw new UpstreamLockError(`${at}: probe.fixture, when present, names a fixture`);
  }
  const argv = stringsAt(value, 'argv', `${at}.probe`);
  if (argv.length === 0) {
    throw new UpstreamLockError(`${at}: probe.argv is the real argument vector and is never empty`);
  }
  return Object.freeze({
    program: stringAt(value, 'program', `${at}.probe`),
    argv,
    ...(fixture !== undefined ? { fixture } : {}),
    ...(capture !== undefined ? { capture } : {}),
  });
}

function readExpectation(value: unknown, at: string): LockExpectation {
  if (!isRecord(value)) throw new UpstreamLockError(`${at}: expect is required and is an object`);
  const status = value['status'];
  if (status !== undefined && typeof status !== 'number') {
    throw new UpstreamLockError(`${at}: expect.status, when present, is the observed exit status`);
  }
  const text = (key: 'stderrIncludes' | 'stderrExcludes' | 'capture'): string | undefined => {
    const found = value[key];
    if (found === undefined) return undefined;
    if (typeof found !== 'string') throw new UpstreamLockError(`${at}: expect.${key} is a string`);
    return found;
  };
  const includes = text('stderrIncludes');
  const excludes = text('stderrExcludes');
  const capture = text('capture');
  return Object.freeze({
    ...(typeof status === 'number' ? { status } : {}),
    ...(includes !== undefined ? { stderrIncludes: includes } : {}),
    ...(excludes !== undefined ? { stderrExcludes: excludes } : {}),
    ...(capture !== undefined ? { capture } : {}),
  });
}

function readEntry(value: unknown, index: number): LockEntry {
  const at = `entries[${String(index)}]`;
  if (!isRecord(value)) throw new UpstreamLockError(`${at}: every entry is an object`);
  const named = (kind: LockElementKind): string | undefined => {
    const found = value[kind];
    if (found === undefined) return undefined;
    if (typeof found !== 'string' || found === '') {
      throw new UpstreamLockError(`${at}: ${kind} must be a non-empty string`);
    }
    return found;
  };
  const traces = stringsAt(value, 'tracesTo', at);
  if (traces.length === 0) {
    throw new UpstreamLockError(
      `${at}: tracesTo is empty, so nothing in the corpus depends on this element and the lock has grown past what it watches`,
    );
  }
  const flag = named('flag');
  const behavior = named('behavior');
  const stderrPattern = named('stderrPattern');
  const entry: LockEntry = Object.freeze({
    ...(flag !== undefined ? { flag } : {}),
    ...(behavior !== undefined ? { behavior } : {}),
    ...(stderrPattern !== undefined ? { stderrPattern } : {}),
    lockedVersion: stringAt(value, 'lockedVersion', at),
    observedAt: stringAt(value, 'observedAt', at),
    tracesTo: traces,
    probe: readProbe(value['probe'], at),
    expect: readExpectation(value['expect'], at),
  });
  elementKindOf(entry, at);
  return entry;
}

/** The lock file's text, read as a lock file or refused by name. */
export function parseLock(text: string): UpstreamLock {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (cause) {
    throw new UpstreamLockError(`the lock file is not JSON: ${(cause as Error).message}`);
  }
  if (!isRecord(value)) throw new UpstreamLockError('the lock file is a JSON object');
  if (value['upstreamWatch'] !== 1) {
    throw new UpstreamLockError('the lock file declares "upstreamWatch": 1, and this one does not');
  }
  const entries = value['entries'];
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new UpstreamLockError('a lock file with no entries watches nothing and is refused');
  }
  const read = entries.map((entry, index) => readEntry(entry, index));
  const subjects = new Set<string>();
  for (const entry of read) {
    const subject = subjectOf(entry);
    if (subjects.has(subject)) {
      throw new UpstreamLockError(`${subject} is locked twice, so a drift report could not name it`);
    }
    subjects.add(subject);
  }
  return Object.freeze({
    comprehendo: stringAt(value, 'comprehendo', 'lock'),
    upstreamWatch: 1,
    provider: stringAt(value, 'provider', 'lock'),
    target: stringAt(value, 'target', 'lock'),
    lockedVersion: stringAt(value, 'lockedVersion', 'lock'),
    observedAt: stringAt(value, 'observedAt', 'lock'),
    entries: Object.freeze(read),
  });
}

/** The lock file beside a corpus, read from disk. */
export function readLock(path: string): UpstreamLock {
  if (!existsSync(path)) {
    throw new UpstreamLockError(
      `no lock file at ${path}: a corpus over a tool the registry does not own is watched by one, and its absence is never a pass`,
    );
  }
  return parseLock(readFileSync(path, 'utf8'));
}
