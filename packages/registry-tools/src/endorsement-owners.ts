// RED-GATE STUB, replaced in the implement phase.

export const GITHUB_SCHEME = 'github';

export interface DelegationInput {
  readonly owners: readonly string[] | undefined;
  readonly approvers: readonly string[] | undefined;
}

export interface Delegation {
  readonly approved: boolean;
  readonly delegate?: string;
  readonly reasons: readonly string[];
}

export function githubApprovers(_logins: readonly string[]): readonly string[] {
  throw new Error('MDD skeleton');
}

export function approvingDelegate(_input: DelegationInput): Delegation {
  throw new Error('MDD skeleton');
}
