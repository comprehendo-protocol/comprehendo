// RED-GATE STUB, replaced in the implement phase.

import type { CorpusSource } from './corpus-source.js';

/** How one cataloged failure is really provoked against the real package. */
export interface InductionWitness {
  readonly code: string;
  /** Literal call data into the declared surface: `{operation: [args]}`. */
  readonly induce: unknown;
}

export type ModuleLoader = (entryPath: string) => Promise<Record<string, unknown>>;

export interface UpstreamOptions {
  readonly corpus: CorpusSource;
  readonly directory: string;
  /** Where CI really installed the target package (a real node_modules root). */
  readonly installRoot: string;
  readonly witnesses: readonly InductionWitness[];
  readonly load?: ModuleLoader;
}

export type TruthFailureKind =
  | 'no-such-package'
  | 'directory-mismatch'
  | 'unloadable'
  | 'unrunnable-witness'
  | 'not-inducible'
  | 'misrouted'
  | 'fix-did-not-resolve';

export interface TruthFailure {
  readonly kind: TruthFailureKind;
  readonly at: string;
  readonly detail: string;
}

export interface UpstreamVerification {
  readonly directory: string;
  readonly package: string;
  readonly resolved?: { readonly name: string; readonly version: string };
  /** Twin codes a real thrown error really matched, this run. */
  readonly inducedCodes: readonly string[];
  /** `code :: fix title` for every fix whose apply really resolved the failure. */
  readonly verifiedFixes: readonly string[];
  readonly failures: readonly TruthFailure[];
}

export const fixKey = (_code: string, _title: string): string => {
  throw new Error('MDD skeleton');
};

export function verifyAgainstUpstream(_options: UpstreamOptions): Promise<UpstreamVerification> {
  throw new Error('MDD skeleton');
}
