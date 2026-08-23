// RED-GATE STUB, replaced in the implement phase.

import type { GateFinding, SubmissionCorpus } from './gate-result.js';
import type { UpstreamVerification } from './gate-upstream.js';

export function folkloreFindings(
  _submission: SubmissionCorpus,
  _verification: UpstreamVerification | undefined,
): readonly GateFinding[] {
  throw new Error('MDD skeleton');
}

export function registryTruthFindings(
  _submission: SubmissionCorpus,
  _verification: UpstreamVerification | undefined,
): readonly GateFinding[] {
  throw new Error('MDD skeleton');
}
