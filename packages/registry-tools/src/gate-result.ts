// RED-GATE STUB, replaced in the implement phase. Types are real so the suite
// typechecks; every body throws so no assertion can pass vacuously.

import type { CorpusSource } from './corpus-source.js';

export type GateCheck =
  | 'corpusFormat'
  | 'schemaBoundFix'
  | 'docsPointerIntegrity'
  | 'folklore'
  | 'registryTruth'
  | 'fingerprintLint'
  | 'loopLint'
  | 'budget'
  | 'dangerLint'
  | 'injectionLint'
  | 'telemetryScan';

export const GATE_CHECKS: readonly GateCheck[] = [];

export type CheckOutcome = 'pass' | 'fail' | 'not-run';

export interface GateFinding {
  readonly check: GateCheck;
  readonly corpus: string;
  readonly locator: string;
  readonly message: string;
}

/** One corpus directory in the PR, parsed. */
export interface SubmissionCorpus {
  /** The directory name in the registry repo. The typosquat check's subject. */
  readonly directory: string;
  readonly source: CorpusSource;
}

export function finding(
  _check: GateCheck,
  _corpus: string,
  _locator: string,
  _message: string,
): GateFinding {
  throw new Error('MDD skeleton');
}

export function renderFinding(_found: GateFinding): string {
  throw new Error('MDD skeleton');
}
