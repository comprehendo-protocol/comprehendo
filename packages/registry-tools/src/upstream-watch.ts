// Upstream Watch [34]: MDD skeleton, the drift comparison. Not implemented yet.
import type { LockEntry, UpstreamLock } from './upstream-lock.js';
import type { TruthFailure, UpstreamVerification } from './gate-upstream.js';

export interface SurfaceObservation {
  readonly subject: string;
  readonly status: number;
  readonly stderr: string;
  readonly capture?: string;
}
export type WatchDriftKind =
  | 'flag-changed'
  | 'behavior-changed'
  | 'pattern-unmatched'
  | 'element-unprobed';
export interface WatchDriftRecord {
  readonly kind: WatchDriftKind;
  readonly subject: string;
  readonly was?: string;
  readonly now?: string;
}
export interface WatchReport {
  readonly target: string;
  readonly scanned_version: string;
  readonly locked_version: string;
  readonly locked: number;
  readonly drift: readonly WatchDriftRecord[];
}
const skeleton = (at: string): never => {
  throw new Error(`MDD skeleton: ${at} is not implemented`);
};
export function computeSurfaceDrift(
  _lock: UpstreamLock,
  _observations: readonly SurfaceObservation[],
): readonly WatchDriftRecord[] {
  return skeleton('computeSurfaceDrift');
}
export function watchReport(
  _lock: UpstreamLock,
  _observations: readonly SurfaceObservation[],
  _scanned: string,
): WatchReport {
  return skeleton('watchReport');
}
export function formatWatchReport(_report: WatchReport): readonly string[] {
  return skeleton('formatWatchReport');
}
export function watchExitCode(_report: WatchReport): number {
  return skeleton('watchExitCode');
}
export function driftAsTruthFailures(
  _lock: UpstreamLock,
  _report: WatchReport,
): readonly TruthFailure[] {
  return skeleton('driftAsTruthFailures');
}
export function withWatchDrift(
  _verification: UpstreamVerification,
  _failures: readonly TruthFailure[],
): UpstreamVerification {
  return skeleton('withWatchDrift');
}
export type { LockEntry };
