// RED-GATE STUB, replaced in the implement phase.

import type { GateFinding, SubmissionCorpus } from './gate-result.js';

export const DESTRUCTIVE_OPERATIONS: readonly string[] = [];

export const INSTRUCTION_PHRASES: readonly string[] = [];

export function loopLintFindings(_submission: SubmissionCorpus): readonly GateFinding[] {
  throw new Error('MDD skeleton');
}

export function dangerLintFindings(_submission: SubmissionCorpus): readonly GateFinding[] {
  throw new Error('MDD skeleton');
}

export function injectionLintFindings(_submission: SubmissionCorpus): readonly GateFinding[] {
  throw new Error('MDD skeleton');
}
