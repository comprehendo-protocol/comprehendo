// RED-GATE STUB, replaced in the implement phase.

import type { FingerprintIndex } from './fingerprint.js';
import type { BudgetMeter } from './gate-budget.js';
import type { PullRequestFacts, MergePolicy } from './gate-policy.js';
import type { CheckOutcome, GateCheck, GateFinding, SubmissionCorpus } from './gate-result.js';
import type { UpstreamVerification } from './gate-upstream.js';

export interface GateInput {
  readonly prId: string;
  readonly corpora: readonly SubmissionCorpus[];
  /** Corpora already on main: their fingerprints share ONE index with the PR's. */
  readonly published?: readonly SubmissionCorpus[];
  readonly upstream?: readonly UpstreamVerification[];
  readonly measure?: BudgetMeter;
  readonly pr?: PullRequestFacts;
}

export interface GateResult {
  readonly prId: string;
  readonly checks: Readonly<Record<GateCheck, CheckOutcome>>;
  readonly pass: boolean;
  /** Only a submission that passed every check may be packed and published. */
  readonly publishable: boolean;
  readonly violations: readonly string[];
  readonly findings: readonly GateFinding[];
  readonly merge: MergePolicy;
  /** The one compiled index, built from every corpus, when it builds at all. */
  readonly index: FingerprintIndex | undefined;
}

export function runSubmissionGate(_input: GateInput): GateResult {
  throw new Error('MDD skeleton');
}
