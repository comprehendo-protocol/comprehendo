// Submission Gate [29]: the gate's shared vocabulary, in one place.
//
// What a submission IS, what the checks are called, what a finding IS, and how
// a finding renders into the one PR comment a corpus author reads. Every check
// module in this component reports this shape and nothing else, so the gate
// itself never has to know how any individual check reached its answer.
//
// A finding is DATA, never an exception, for the same reason Corpus Format
// [28]'s violations are: a corpus author fixing one finding per CI run is how a
// submission channel dies. The gate reports everything it found, once.

import type { CorpusSource } from './corpus-source.js';

/**
 * The checks the doc's Data Model names, plus the three the Business Rules add
 * (danger lint, injection lint) and CC6 [27]'s corpus-side telemetry scan, plus
 * `corpusFormat` for everything else Corpus Format [28]'s `validate` reports
 * (CC3 [08], the catalog rules, stubs). Every one of them must pass before a
 * corpus is merge-eligible.
 */
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

export const GATE_CHECKS: readonly GateCheck[] = Object.freeze([
  'corpusFormat',
  'schemaBoundFix',
  'docsPointerIntegrity',
  'folklore',
  'registryTruth',
  'fingerprintLint',
  'loopLint',
  'budget',
  'dangerLint',
  'injectionLint',
  'telemetryScan',
] as const);

/**
 * `not-run` is a third outcome on purpose. A gate that cannot run a check has
 * not passed it, and collapsing the two into a boolean is exactly how a
 * missing verification step becomes a green build.
 */
export type CheckOutcome = 'pass' | 'fail' | 'not-run';

export interface GateFinding {
  readonly check: GateCheck;
  /** The corpus directory this finding is about. */
  readonly corpus: string;
  /** Where inside it, addressable enough for an author to go and fix it. */
  readonly locator: string;
  readonly message: string;
}

/** One corpus directory in the PR, parsed. */
export interface SubmissionCorpus {
  /** The directory name in the registry repo. The typosquat check's subject. */
  readonly directory: string;
  readonly source: CorpusSource;
}

export const finding = (
  check: GateCheck,
  corpus: string,
  locator: string,
  message: string,
): GateFinding => Object.freeze({ check, corpus, locator, message });

/** One finding as the line a PR comment carries. */
export const renderFinding = (found: GateFinding): string =>
  `${found.check} at ${found.corpus}/${found.locator}: ${found.message}`;
