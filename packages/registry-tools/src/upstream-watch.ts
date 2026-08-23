// Upstream Watch [34]: the drift comparison, and the report it produces.
//
// WHAT THIS REUSES FROM `comprehendo diff` [17], AND WHAT IT CANNOT.
// 17's `computeDrift` walks a target package's TypeScript exports and throw
// sites and diffs them against the corpus. That SCANNER cannot reach a command
// line program: ffmpeg has argv and stderr, not exported symbols, which is the
// same wall ffmpeg Corpus [32] hit with `verifyAgainstUpstream` and recorded
// rather than papered over. What DOES generalize is everything downstream of
// the scan, and it is reused deliberately rather than reinvented:
//   - a drift RECORD is `{kind, subject, was?, now?}`, the four fields
//     `diff.ts` declares, so a reader who has read one report can read this one;
//   - the report envelope keeps `target` and `scanned_version` verbatim;
//   - the exit code is `drift.length > 0 ? 1 : 0`, 17's own rule;
//   - the report NEVER writes, for 17's stated reason: a report that edits what
//     it reports on cannot be run twice.
// Two honest departures, both because the subject is a lock file rather than a
// corpus: `corpus_version` becomes `locked_version` (what the lock recorded is
// the "was" side here), and there is no `stubs` list, because nothing in a lock
// file can be a stub. A field faked to preserve a shape is worse than a shape
// that says what it means.
//
// AND WHAT IT DOES NOT KNOW. Nothing in this file knows what ffmpeg is. It
// compares a locked EXPECTATION against an OBSERVATION somebody else made, so
// the next sidecar over a tool the registry does not own reuses it by writing
// its own probe runner and its own lock file, which is what the feature doc
// asks for.

import { matchesPattern } from './fingerprint-facets.js';
import type { TruthFailure, UpstreamVerification } from './gate-upstream.js';
import { elementKindOf, subjectOf } from './upstream-lock.js';
import type { LockElementKind, LockEntry, UpstreamLock } from './upstream-lock.js';

/** What a probe really saw when it re-ran a locked element's invocation. */
export interface SurfaceObservation {
  /** The locked element this observation is of, per `subjectOf`. */
  readonly subject: string;
  readonly status: number;
  readonly stderr: string;
  /** The named reading the probe took, when the entry asked for one. */
  readonly capture?: string;
}

export type WatchDriftKind =
  | 'flag-changed'
  | 'behavior-changed'
  | 'pattern-unmatched'
  | 'element-unprobed';

/** One changed surface element. The same four fields `diff.ts` reports. */
export interface WatchDriftRecord {
  readonly kind: WatchDriftKind;
  readonly subject: string;
  readonly was?: string;
  readonly now?: string;
}

export interface WatchReport {
  readonly target: string;
  /** The version of the tool the probes really ran against, just now. */
  readonly scanned_version: string;
  /** The version the lock file recorded when the elements were observed. */
  readonly locked_version: string;
  readonly locked: number;
  readonly drift: readonly WatchDriftRecord[];
}

const DRIFT_OF: Readonly<Record<LockElementKind, WatchDriftKind>> = Object.freeze({
  flag: 'flag-changed',
  behavior: 'behavior-changed',
  stderrPattern: 'pattern-unmatched',
});

/**
 * The last few lines the run really wrote, which is where a command line tool
 * puts its complaint.
 *
 * Deliberately a TAIL rather than the first line: ffmpeg opens with a banner
 * and an input report, and the line that changed is at the end, usually one
 * above the summary line. Bounded at three so a drift report stays readable
 * when a run wrote a hundred lines of progress.
 */
function stderrTail(stderr: string, lines = 3): string {
  const meaningful = stderr
    .split('\n')
    .map((one) => one.trim())
    .filter((one) => one !== '');
  if (meaningful.length === 0) return '(the run wrote nothing to stderr)';
  return meaningful.slice(-lines).join(' / ');
}

/** Every way one locked element can have stopped being true, in order. */
function driftOfEntry(entry: LockEntry, seen: SurfaceObservation): WatchDriftRecord[] {
  const kind = elementKindOf(entry);
  const subject = subjectOf(entry);
  const record = (was: string, now: string): WatchDriftRecord =>
    Object.freeze({ kind: DRIFT_OF[kind], subject, was, now });
  const found: WatchDriftRecord[] = [];

  // A locked stderr pattern IS its own expectation: the cataloged text is what
  // the fingerprint matches on, so the check is 21's REAL matcher over the
  // stderr this run really wrote, never a second pattern language.
  const pattern = entry.stderrPattern;
  if (pattern !== undefined && !matchesPattern(pattern, seen.stderr)) {
    found.push(
      record(
        `the run really wrote stderr matching ${pattern} on ${entry.lockedVersion}`,
        stderrTail(seen.stderr),
      ),
    );
  }
  if (entry.expect.status !== undefined && entry.expect.status !== seen.status) {
    found.push(
      record(`exit status ${String(entry.expect.status)}`, `exit status ${String(seen.status)}`),
    );
  }
  const includes = entry.expect.stderrIncludes;
  if (includes !== undefined && !seen.stderr.includes(includes)) {
    found.push(record(`stderr carrying ${includes}`, stderrTail(seen.stderr)));
  }
  const excludes = entry.expect.stderrExcludes;
  if (excludes !== undefined && seen.stderr.includes(excludes)) {
    found.push(record(`stderr NOT carrying ${excludes}`, stderrTail(seen.stderr)));
  }
  const capture = entry.expect.capture;
  if (capture !== undefined && capture !== (seen.capture ?? '')) {
    found.push(record(capture, seen.capture ?? '(nothing was read)'));
  }
  return found;
}

/**
 * Every locked element that no longer matches what the tool really does.
 *
 * An element with no observation is drift, never a pass: a probe that could not
 * run has told you nothing, and reporting nothing as clean is the exact failure
 * mode a watch exists to prevent.
 */
export function computeSurfaceDrift(
  lock: UpstreamLock,
  observations: readonly SurfaceObservation[],
): readonly WatchDriftRecord[] {
  const seenBy = new Map(observations.map((one) => [one.subject, one]));
  const drift: WatchDriftRecord[] = [];
  for (const entry of lock.entries) {
    const subject = subjectOf(entry);
    const seen = seenBy.get(subject);
    if (seen === undefined) {
      drift.push(
        Object.freeze({
          kind: 'element-unprobed' as const,
          subject,
          was: `locked against ${entry.lockedVersion} on ${entry.observedAt}`,
          now: 'no probe observed this element on this run',
        }),
      );
      continue;
    }
    drift.push(...driftOfEntry(entry, seen));
  }
  return Object.freeze(drift);
}

/** The whole watch result, in `comprehendo diff`'s report shape. */
export function watchReport(
  lock: UpstreamLock,
  observations: readonly SurfaceObservation[],
  scanned: string,
): WatchReport {
  return Object.freeze({
    target: lock.target,
    scanned_version: scanned,
    locked_version: lock.lockedVersion,
    locked: lock.entries.length,
    drift: computeSurfaceDrift(lock, observations),
  });
}

/** The human report, line by line, in `diff.ts`'s layout. */
export function formatWatchReport(report: WatchReport): readonly string[] {
  const lines: string[] = [
    `comprehendo upstream-watch ${report.target}@${report.scanned_version} ` +
      `(lock recorded ${report.locked_version})`,
    `locked: ${String(report.locked)}`,
    `drift: ${String(report.drift.length)}`,
  ];
  for (const entry of report.drift) {
    lines.push(`  ${entry.kind}  ${entry.subject}`);
    if (entry.was !== undefined) lines.push(`    was: ${entry.was}`);
    if (entry.now !== undefined) lines.push(`    now: ${entry.now}`);
  }
  return Object.freeze(lines);
}

/** Drift alone decides the exit code, exactly as `runDiff` does. */
export function watchExitCode(report: WatchReport): number {
  return report.drift.length > 0 ? 1 : 0;
}

/** The twin codes a locked element is depended on by, from its traces. */
const twinsOf = (entry: LockEntry): readonly string[] =>
  entry.tracesTo.filter((trace) => trace.startsWith('twin:')).map((trace) => trace.slice(5));

/**
 * Drift, as the failure value CC4 [26]'s gate already reads.
 *
 * The doc's third business rule is that a watch failure routes into the
 * folklore gate's drift-failure path rather than into a private one, and this
 * is that routing: a drifted element is reported AT every twin the lock says
 * depends on it, with `not-inducible`, which is the kind `gate-folklore.ts`
 * describes as "cataloged and no longer reproduces against the real package:
 * drift". An element no twin depends on still produces a failure, named at the
 * element itself, so `registryTruthFindings` reports it and nothing is dropped
 * for want of a twin to hang it on.
 */
export function driftAsTruthFailures(
  lock: UpstreamLock,
  report: WatchReport,
): readonly TruthFailure[] {
  const bySubject = new Map(lock.entries.map((entry) => [subjectOf(entry), entry]));
  const failures: TruthFailure[] = [];
  for (const record of report.drift) {
    const entry = bySubject.get(record.subject);
    const kind: TruthFailure['kind'] =
      record.kind === 'element-unprobed' ? 'unrunnable-witness' : 'not-inducible';
    const detail =
      `the upstream watch found ${record.subject} changed on ${report.target}@${report.scanned_version} ` +
      `(locked against ${report.locked_version}): was ${record.was ?? '(unrecorded)'}, now ${record.now ?? '(unrecorded)'}`;
    const twins = entry === undefined ? [] : twinsOf(entry);
    if (twins.length === 0) {
      failures.push(Object.freeze({ kind, at: record.subject, detail }));
      continue;
    }
    for (const code of twins) failures.push(Object.freeze({ kind, at: code, detail }));
  }
  return Object.freeze(failures);
}

/**
 * The upstream verification the gate reads, with the watch's findings folded
 * in: a twin the watch found drifted stops counting as induced, because the
 * evidence that it reproduces is exactly what the watch just contradicted.
 */
export function withWatchDrift(
  verification: UpstreamVerification,
  failures: readonly TruthFailure[],
): UpstreamVerification {
  if (failures.length === 0) return verification;
  const drifted = new Set(failures.map((failure) => failure.at));
  return Object.freeze({
    ...verification,
    inducedCodes: Object.freeze(verification.inducedCodes.filter((code) => !drifted.has(code))),
    verifiedFixes: Object.freeze(
      verification.verifiedFixes.filter((fix) => !drifted.has(fix.split(' :: ')[0] ?? fix)),
    ),
    failures: Object.freeze([...verification.failures, ...failures]),
  });
}
