// Upstream Watch [34]: MDD skeleton, the lock format. Not implemented yet.
import type { TruthFailure } from './gate-upstream.js';

export type LockElementKind = 'flag' | 'behavior' | 'stderrPattern';
export const LOCK_ELEMENT_KINDS: readonly LockElementKind[] = Object.freeze([
  'flag',
  'behavior',
  'stderrPattern',
]);
export interface LockCapture {
  readonly read: string;
  readonly file: string;
}
export interface LockProbe {
  readonly program: string;
  readonly argv: readonly string[];
  readonly fixture?: string;
  readonly capture?: LockCapture;
}
export interface LockExpectation {
  readonly status?: number;
  readonly stderrIncludes?: string;
  readonly stderrExcludes?: string;
  readonly capture?: string;
}
export interface LockEntry {
  readonly flag?: string;
  readonly behavior?: string;
  readonly stderrPattern?: string;
  readonly lockedVersion: string;
  readonly observedAt: string;
  readonly tracesTo: readonly string[];
  readonly probe: LockProbe;
  readonly expect: LockExpectation;
}
export interface UpstreamLock {
  readonly comprehendo: string;
  readonly upstreamWatch: 1;
  readonly provider: string;
  readonly target: string;
  readonly lockedVersion: string;
  readonly observedAt: string;
  readonly entries: readonly LockEntry[];
}
export class UpstreamLockError extends Error {
  public override readonly name = 'UpstreamLockError';
}
const skeleton = (at: string): never => {
  throw new Error(`MDD skeleton: ${at} is not implemented`);
};
export function elementKindOf(_entry: LockEntry, _at?: string): LockElementKind {
  return skeleton('elementKindOf');
}
export function subjectOf(_entry: LockEntry): string {
  return skeleton('subjectOf');
}
export function parseLock(_text: string): UpstreamLock {
  return skeleton('parseLock');
}
export function readLock(_path: string): UpstreamLock {
  return skeleton('readLock');
}
export type { TruthFailure };
