// Recorder [16]: the optional maintainer black box.
//
// An opt-in wrapper around the object SDK Entry [14] returns. When a
// maintainer turns it on, every call through the provider is appended to a
// LOCAL FILE in both directions, the call in and the response out, each line
// stamped with the moment it happened, so a session can be replayed exactly as
// the agent experienced it.
//
// Three properties this module is held to, all of them tested rather than
// asserted (test/recorder.test.ts):
//
//   1. OFF BY DEFAULT, and off means absent. `recordProvider(p)` with nothing
//      enabling it returns `p` itself, the same object reference, so there is
//      no wrapper to allocate and no per-call branch to execute. "Zero
//      overhead when off" is identity, not a disabled code path.
//   2. BOTH DIRECTIONS. The `in` record is written BEFORE the underlying call
//      runs and the `out` record after it returns (or after it throws, which
//      is what `raise` always does), so a recording is a transcript, not a
//      summary.
//   3. NOWHERE BUT DISK (CC6 [27]). This module imports node:fs and node:path
//      and nothing else. There is no transport here, no host, no address, and
//      the CC6 scan in the test file covers this module AND its whole relative
//      import closure, because a transitive import is what would defeat that.
//
// This is not telemetry and it is not the Docs Engine [13] miss log: the miss
// log records docs lookups for corpus authoring, this records the whole
// provider surface for debugging. It follows that log's conventions on
// purpose, an injected sink or a JSON-Lines append, and a write failure that
// is counted rather than raised at the call it was recording.
//
// Deliberately NOT re-exported from the package barrel: a barrel entry would
// load this module on every import of the package, which is exactly the
// "never in the default runtime path when disabled" rule it must satisfy.
//
// @see .mdd/docs/16-recorder.md
// @see JUDGMENT-16-recorder.md

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { attachMarker } from './marker.js';
import type { LogStats } from './docs.js';
import type { Explanation, Provider, Validation } from './sdk.js';
import type { ComprehendoError, Twin, TwinContext } from './twin.js';

/** Where a recording goes when the maintainer names no path. Relative, local, never outside the cwd. */
export const DEFAULT_RECORDING_PATH = '.comprehendo/recording.log';

/** The provider surfaces a recording covers. `twinFor`/`errorFor`/`raise` all record as `twin`. */
export type RecordedSurface = 'twin' | 'docs' | 'validate' | 'explain';

/** The call in, or the response out. Every call produces exactly one of each. */
export type RecordedDirection = 'in' | 'out';

/** One line of a recording (the doc's Data Model, verbatim). */
export interface CallRecord {
  readonly timestamp: string;
  readonly direction: RecordedDirection;
  readonly surface: RecordedSurface;
  readonly payload: unknown;
}

/** Where a record goes. The default writes a local file; a maintainer may inject their own. */
export type RecordSink = (record: CallRecord) => void;

/** What a recording could not write. A black box that quietly stopped recording is worse than none. */
export type RecordingStats = LogStats;

/** The handle on a live recording, reachable with {@link recordingOf}. */
export interface Recording {
  /** The file this recording appends to, absent when a sink was injected instead. */
  readonly path?: string;
  stats(): RecordingStats;
}

export interface RecorderOptions {
  /** The opt-in. Anything other than `true` leaves the provider untouched. */
  readonly enabled?: boolean;
  /** Local file to append to. Defaults to {@link DEFAULT_RECORDING_PATH}. */
  readonly logPath?: string;
  /** Take the records yourself instead of writing a file. */
  readonly sink?: RecordSink;
  /** Injectable clock, so a recording's timestamps are testable. */
  readonly now?: () => Date;
}

/** Live recordings, keyed by the wrapper handed back. A WeakMap, so wrapping pins nothing in memory. */
const recordings = new WeakMap<object, Recording>();

/**
 * The recording attached to a provider, or `undefined` for a provider that is
 * not being recorded, which is every provider by default.
 */
export function recordingOf(value: unknown): Recording | undefined {
  return typeof value === 'object' && value !== null ? recordings.get(value) : undefined;
}

/** Append-only local file, one JSON object per line. Never transmitted, nowhere to transmit to. */
function fileSink(logPath: string): RecordSink {
  const target = resolve(logPath);
  return (record) => {
    // Serialised first: a payload that cannot be serialised must fail before
    // this creates a directory for a line it will never write.
    const line = `${JSON.stringify(record)}\n`;
    mkdirSync(dirname(target), { recursive: true });
    appendFileSync(target, line, 'utf8');
  };
}

const isError = (value: unknown): value is Error => value instanceof Error;

/**
 * `JSON.stringify(new Error('x'))` is `{}`, so an Error recorded as-is loses
 * everything worth replaying, its twin above all. Normalising here (rather
 * than in the file sink) is what keeps the promise that an injected sink sees
 * exactly the records the file would carry.
 */
function describeValue(value: unknown): unknown {
  if (!isError(value)) return value;
  const twin = (value as Partial<ComprehendoError>).twin;
  return {
    name: value.name,
    message: value.message,
    ...(twin === undefined ? {} : { twin }),
  };
}

interface Writer {
  readonly record: (direction: RecordedDirection, surface: RecordedSurface, payload: unknown) => void;
  readonly stats: () => RecordingStats;
}

function createWriter(options: RecorderOptions): Writer {
  const clock = options.now ?? ((): Date => new Date());
  const sink = options.sink ?? fileSink(options.logPath ?? DEFAULT_RECORDING_PATH);
  let written = 0;
  let failed = 0;

  return {
    // A recording this module cannot write is never a reason to break the call
    // it was recording, and never a reason to go quiet about it either: the
    // counter is what stops a black box that stopped recording a week ago from
    // looking like a week with nothing to record.
    record: (direction, surface, payload): void => {
      const entry: CallRecord = {
        timestamp: clock().toISOString(),
        direction,
        surface,
        payload,
      };
      try {
        sink(entry);
        written += 1;
      } catch {
        failed += 1;
      }
    },
    stats: (): RecordingStats => ({ written, failed }),
  };
}

/**
 * Wrap one call so the recording carries both of its directions. The `in`
 * record is written before the call runs, so the transcript survives a call
 * that never returns; the `out` record is written on the way back OUT,
 * whether that is a return or a throw, and the throw is rethrown untouched.
 */
function around<Args extends unknown[], Result>(
  writer: Writer,
  surface: RecordedSurface,
  method: string,
  call: (...args: Args) => Result,
): (...args: Args) => Result {
  return (...args: Args): Result => {
    writer.record('in', surface, { method, args: args.map(describeValue) });
    let returned: Result;
    try {
      returned = call(...args);
    } catch (error) {
      writer.record('out', surface, { method, thrown: describeValue(error) });
      throw error;
    }
    writer.record('out', surface, { method, returned: describeValue(returned) });
    return returned;
  };
}

/**
 * The three throw-site calls, all recorded under the one `twin` surface the
 * doc's data model names, told apart by `method` in the payload. `raise` is
 * the reason the throwing direction is recorded at all: it ALWAYS ends in a
 * throw, so a recorder that only captured returns would capture nothing of it.
 */
function twinSurfaces(
  provider: Provider,
  writer: Writer,
): Pick<Provider, 'twinFor' | 'errorFor' | 'raise'> {
  return {
    twinFor: around(writer, 'twin', 'twinFor', (raw: unknown, context?: TwinContext): Twin =>
      provider.twinFor(raw, context),
    ),
    errorFor: around(
      writer,
      'twin',
      'errorFor',
      (raw: unknown, context?: TwinContext): Error & ComprehendoError =>
        provider.errorFor(raw, context),
    ),
    raise: around(writer, 'twin', 'raise', (raw: unknown, context?: TwinContext): never => {
      provider.raise(raw, context);
    }),
  };
}

/**
 * The stand-in a caller ends up holding: the provider's declaration fields
 * unchanged, each callable surface wrapped so both of its directions are
 * recorded, and the judge surfaces present EXACTLY when the provider has them,
 * so recording a Level 1 provider never grows it a `validate` key that answers
 * `undefined`.
 */
function wrapSurfaces(provider: Provider, writer: Writer): Provider {
  const judge = provider.validate;
  const explainer = provider.explain;

  const docs = Object.assign(
    around(writer, 'docs', 'docs', (...args: [string?]) => provider.docs(...args)),
    { logStats: (): LogStats => provider.docs.logStats() },
  );

  return {
    name: provider.name,
    comprehendo: provider.comprehendo,
    level: provider.level,
    surfaces: provider.surfaces,
    entry: provider.entry,
    manifest: provider.manifest,
    docs,
    // The raw builder is passed through, not wrapped: `twinFor` already
    // delegates to it, so wrapping both would record one event twice.
    twins: provider.twins,
    ...twinSurfaces(provider, writer),
    // Attaching the marker to a handle is not a call through the protocol, so
    // it passes through: recording it would put a line in the transcript that
    // no replay could act on.
    mark: <T extends object>(target: T) => provider.mark(target),
    ...(judge === undefined
      ? {}
      : {
          validate: around(writer, 'validate', 'validate', (input: unknown): Validation =>
            judge(input),
          ),
        }),
    ...(explainer === undefined
      ? {}
      : {
          explain: around(writer, 'explain', 'explain', (input: unknown): Explanation =>
            explainer(input),
          ),
        }),
  };
}

/**
 * Record every call through `provider`, in both directions, to a local file.
 *
 * OFF BY DEFAULT: without `enabled: true` this hands back the very same
 * provider object, unwrapped and unmodified, so a package that never opts in
 * pays nothing at all, not even an indirection. With it on, the returned
 * object is a full stand-in for the provider, carrying the same marker: a
 * probe on the recording wrapper answers with the provider's own entry.
 */
export function recordProvider(provider: Provider, options: RecorderOptions = {}): Provider {
  if (options.enabled !== true) return provider;

  const writer = createWriter(options);
  // The same entry object the provider carries, so probing the recording
  // wrapper and probing the provider answer identically. A recorder that
  // changed what a value claims about itself would be a debugging aid that
  // alters the thing it observes.
  const marked = attachMarker(wrapSurfaces(provider, writer), provider.entry);
  recordings.set(marked, {
    ...(options.sink === undefined
      ? { path: resolve(options.logPath ?? DEFAULT_RECORDING_PATH) }
      : {}),
    stats: writer.stats,
  });
  Object.freeze(marked);
  return marked;
}
